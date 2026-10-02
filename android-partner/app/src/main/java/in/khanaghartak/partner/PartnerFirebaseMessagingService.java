package in.khanaghartak.partner;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;

public class PartnerFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "KGT_PartnerFCM";
    private static final String ORDERS_CHANNEL_ID = "orders_channel";
    private static final int ORDER_NOTIFICATION_BASE_ID = 9000;

    private static final Set<String> processedMessageIds = Collections.synchronizedSet(new HashSet<String>());

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token generated: " + token);

        // 1. Forward to Capacitor plugin so web listeners receive it
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Exception ignored) {}

        // 2. Persist locally
        SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
        prefs.edit().putString("fcm_token", token).apply();

        // 3. If partner is currently logged in, sync new token directly with Supabase
        String accessToken = prefs.getString("access_token", null);
        String role = prefs.getString("role", "restaurant");
        String userId = prefs.getString("user_id", null);
        if (accessToken != null && !accessToken.trim().isEmpty() && userId != null) {
            syncTokenToSupabase(accessToken, userId, role, token);
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        // Forward to Capacitor plugin if active
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Exception ignored) {}

        Map<String, String> data = remoteMessage.getData();
        RemoteMessage.Notification notification = remoteMessage.getNotification();

        String notificationType = data.containsKey("notification_type") ? data.get("notification_type") : "NEW_ORDER";
        String orderId = data.containsKey("order_id") ? data.get("order_id") : "";
        String role = data.containsKey("role") ? data.get("role") : "restaurant";

        String title = notification != null && notification.getTitle() != null
                ? notification.getTitle()
                : (data.containsKey("title") ? data.get("title") : "🔔 New Order Alert");

        String body = notification != null && notification.getBody() != null
                ? notification.getBody()
                : (data.containsKey("body") ? data.get("body") : "You have a new update. Tap to view.");

        // Deduplication: prevent processing the exact same FCM message ID twice within memory
        String msgId = remoteMessage.getMessageId() != null ? remoteMessage.getMessageId() : (orderId + "_" + notificationType);
        if (processedMessageIds.contains(msgId)) {
            Log.d(TAG, "Duplicate message ignored: " + msgId);
            return;
        }
        processedMessageIds.add(msgId);

        // Check if MainActivity is currently running in the foreground
        MainActivity activity = MainActivity.getInstance();
        boolean isForeground = (activity != null && MainActivity.isAppInForeground());

        if (isForeground) {
            // App is open in foreground: let MainActivity handle in-app alarm and UI refresh without duplicate system tray noise
            Log.d(TAG, "App is in foreground. Passing to MainActivity.");
            activity.onForegroundFcmAlert(orderId, role, title, body, notificationType);
        } else {
            // App is in Background, Screen Locked, or Completely Closed/Killed:
            // Wake device up, display high-priority heads-up system notification with order_siren.wav
            Log.d(TAG, "App is in background/closed. Posting system notification with order_siren.");
            handleBackgroundOrClosedNotification(orderId, role, title, body, notificationType);
        }
    }

    private void handleBackgroundOrClosedNotification(String orderId, String role, String title, String body, String notificationType) {
        // 1. Acquire WakeLock to turn on and illuminate screen
        PowerManager.WakeLock wakeLock = null;
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                        "KhanaGharTak:PartnerFCMWakeLock"
                );
                wakeLock.acquire(15000); // 15 seconds
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock", e);
        }

        // 2. Ensure notification channel exists with R.raw.order_siren sound
        ensureOrdersNotificationChannel();

        // 3. Build Intent for tapping the notification
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("from_order_alert", true);
        intent.putExtra("order_id", orderId);
        intent.putExtra("role", role);
        intent.putExtra("notification_type", notificationType);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        int notifId = ORDER_NOTIFICATION_BASE_ID;
        if (orderId != null && !orderId.isEmpty()) {
            notifId = Math.abs(orderId.hashCode() % 1000) + ORDER_NOTIFICATION_BASE_ID;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, notifId, intent, pendingFlags);

        // Sound URI for order_siren.wav
        Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.order_siren);

        // 4. Construct High-Priority Notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ORDERS_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSound(soundUri, AudioManager.STREAM_ALARM)
                .setVibrate(new long[]{0, 800, 400, 800, 400})
                .setAutoCancel(true)
                .setOngoing("NEW_ORDER".equals(notificationType) || "DELIVERY_AVAILABLE".equals(notificationType))
                .setContentIntent(pendingIntent)
                .setFullScreenIntent(pendingIntent, true);

        Notification notification = builder.build();
        if ("NEW_ORDER".equals(notificationType) || "DELIVERY_AVAILABLE".equals(notificationType)) {
            notification.flags |= Notification.FLAG_INSISTENT;
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notifId, notification);
        }

        // 5. For critical alerts (NEW_ORDER or DELIVERY_AVAILABLE), also trigger auxiliary MediaPlayer playback
        if ("NEW_ORDER".equals(notificationType) || "DELIVERY_AVAILABLE".equals(notificationType)) {
            playSirenAuxiliary();
        }
    }

    private void ensureOrdersNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.order_siren);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build();

            NotificationChannel existing = nm.getNotificationChannel(ORDERS_CHANNEL_ID);
            // If existing channel does not have the custom siren sound, recreate it
            if (existing != null) {
                Uri currSound = existing.getSound();
                if (currSound == null || !currSound.toString().contains("order_siren")) {
                    try {
                        nm.deleteNotificationChannel(ORDERS_CHANNEL_ID);
                    } catch (Exception ignored) {}
                } else {
                    return; // Already configured with order_siren
                }
            }

            CharSequence ordersName = "Orders & Partner Alerts";
            String ordersDesc = "Instant notifications and continuous sirens for new orders and delivery dispatches";
            NotificationChannel ordersChannel = new NotificationChannel(ORDERS_CHANNEL_ID, ordersName, NotificationManager.IMPORTANCE_HIGH);
            ordersChannel.setDescription(ordersDesc);
            ordersChannel.enableVibration(true);
            ordersChannel.setVibrationPattern(new long[]{0, 800, 400, 800, 400});
            ordersChannel.enableLights(true);
            ordersChannel.setLightColor(Color.parseColor("#F45D2C"));
            ordersChannel.setSound(soundUri, audioAttributes);

            nm.createNotificationChannel(ordersChannel);
        }
    }

    private void playSirenAuxiliary() {
        try {
            // Maximize alarm stream volume
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                am.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
            }

            final MediaPlayer mp = MediaPlayer.create(this, R.raw.order_siren);
            if (mp != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    mp.setAudioAttributes(attrs);
                } else {
                    mp.setAudioStreamType(AudioManager.STREAM_ALARM);
                }
                mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                    @Override
                    public void onCompletion(MediaPlayer player) {
                        try {
                            player.release();
                        } catch (Exception ignored) {}
                    }
                });
                mp.start();
            }
        } catch (Exception e) {
            Log.w(TAG, "Error playing auxiliary siren", e);
        }
    }

    public static void syncTokenToSupabase(final String accessToken, final String userId, final String role, final String fcmToken) {
        if (fcmToken == null || fcmToken.trim().isEmpty() || accessToken == null || accessToken.trim().isEmpty()) {
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("https://bvacebeorvxwcfkselon.supabase.co/rest/v1/user_fcm_tokens?on_conflict=token");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
                    conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("Prefer", "resolution=merge-duplicates");
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.setDoOutput(true);

                    JSONObject body = new JSONObject();
                    body.put("user_id", userId);
                    body.put("token", fcmToken);
                    body.put("app_type", "partner");
                    body.put("role", role != null ? role.toLowerCase() : "restaurant");
                    body.put("platform", "android");
                    body.put("is_active", true);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                    }

                    int code = conn.getResponseCode();
                    Log.d(TAG, "FCM token synced to Supabase. HTTP code: " + code);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to sync FCM token to Supabase", e);
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        }).start();
    }
}
