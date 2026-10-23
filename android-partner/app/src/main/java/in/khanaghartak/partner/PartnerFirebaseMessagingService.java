package in.khanaghartak.partner;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.BufferedReader;
import java.io.InputStreamReader;
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
    public static final String ORDERS_CHANNEL_ID = "orders_channel_v2";
    private static final int ORDER_NOTIFICATION_BASE_ID = 9000;

    private static final Set<String> processedMessageIds = Collections.synchronizedSet(new HashSet<String>());
    private static MediaPlayer auxiliaryMediaPlayer = null;

    public static synchronized void stopAuxiliarySiren() {
        try {
            if (auxiliaryMediaPlayer != null) {
                if (auxiliaryMediaPlayer.isPlaying()) {
                    auxiliaryMediaPlayer.stop();
                }
                auxiliaryMediaPlayer.release();
                auxiliaryMediaPlayer = null;
                Log.d(TAG, "Auxiliary siren stopped.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error stopping auxiliary siren", e);
        }
    }

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
        if (accessToken != null && !accessToken.trim().isEmpty()) {
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

        String title = (data.containsKey("title") && !data.get("title").isEmpty())
                ? data.get("title")
                : (notification != null && notification.getTitle() != null
                    ? notification.getTitle()
                    : "🔔 New Order Alert");

        String body = (data.containsKey("body") && !data.get("body").isEmpty())
                ? data.get("body")
                : (notification != null && notification.getBody() != null
                    ? notification.getBody()
                    : "You have a new update. Tap to view.");

        // Deduplication: prevent processing the exact same FCM message ID twice within memory
        String msgId = remoteMessage.getMessageId() != null ? remoteMessage.getMessageId() : (orderId + "_" + notificationType);
        if (processedMessageIds.contains(msgId)) {
            Log.d(TAG, "Duplicate message ignored: " + msgId);
            return;
        }
        processedMessageIds.add(msgId);

        // Always display high-priority heads-up system notification with order_siren from top of screen!
        handleBackgroundOrClosedNotification(orderId, role, title, body, notificationType);

        // Check if MainActivity is currently running in the foreground
        MainActivity activity = MainActivity.getInstance();
        boolean isForeground = (activity != null && MainActivity.isAppInForeground());

        if (isForeground) {
            Log.d(TAG, "App is in foreground. Passing to MainActivity for UI update.");
            activity.onForegroundFcmAlert(orderId, role, title, body, notificationType);
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
                wakeLock.acquire(20000); // 20 seconds
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock", e);
        }

        // 2. Ensure notification channel exists with canonical raw/order_siren sound
        ensureOrdersNotificationChannel();

        // 3. Build Intent for tapping the notification (Open / Accept)
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

        // 4. Build Intent for silencing the notification
        Intent silenceIntent = new Intent(this, AlarmDismissReceiver.class);
        silenceIntent.setAction(AlarmDismissReceiver.ACTION_DISMISS_ALARM);
        silenceIntent.putExtra(AlarmDismissReceiver.EXTRA_NOTIFICATION_ID, notifId);
        PendingIntent silencePendingIntent = PendingIntent.getBroadcast(this, notifId + 1, silenceIntent, pendingFlags);

        // Canonical Sound URI using resource name
        Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/raw/order_siren");

        // Decode circular/brand logo for right-side Large Icon
        Bitmap largeIcon = null;
        try {
            largeIcon = BitmapFactory.decodeResource(getResources(), R.drawable.ic_kgt_brand_logo);
            if (largeIcon == null) {
                largeIcon = getDrawableBitmap(this, R.mipmap.ic_launcher_round);
            }
            if (largeIcon == null) {
                largeIcon = getDrawableBitmap(this, R.mipmap.ic_launcher);
            }
        } catch (Exception ignored) {}

        // 5. Construct Modern High-Priority Notification (matching modern card style)
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ORDERS_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setColor(Color.parseColor("#F45D2C"))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().setBigContentTitle(title).bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSound(soundUri, AudioManager.STREAM_ALARM)
                .setVibrate(new long[]{0, 800, 400, 800, 400})
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setFullScreenIntent(pendingIntent, true)
                .setDeleteIntent(silencePendingIntent);

        String actionTitle = "VIEW ORDER";
        if ("rider".equals(role)) actionTitle = "VIEW DELIVERY";
        else if ("restaurant".equals(role)) actionTitle = "ACCEPT ORDER";
        builder.addAction(R.drawable.ic_notification, actionTitle, pendingIntent);
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "DISMISS", silencePendingIntent);

        if (largeIcon != null) {
            builder.setLargeIcon(largeIcon);
        }

        Notification notification = builder.build();
        if ("NEW_ORDER".equals(notificationType) || "DELIVERY_AVAILABLE".equals(notificationType)) {
            notification.flags |= Notification.FLAG_INSISTENT;
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notifId, notification);
        }

        // 6. For critical alerts (NEW_ORDER or DELIVERY_AVAILABLE), also trigger auxiliary MediaPlayer playback
        if ("NEW_ORDER".equals(notificationType) || "DELIVERY_AVAILABLE".equals(notificationType)) {
            playSirenAuxiliary();
        }
    }

    private void ensureOrdersNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // Canonical sound URI
            Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/raw/order_siren");

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build();

            // Clean up old legacy channel if present
            try {
                NotificationChannel legacyChannel = nm.getNotificationChannel("orders_channel");
                if (legacyChannel != null) {
                    nm.deleteNotificationChannel("orders_channel");
                }
            } catch (Exception ignored) {}

            NotificationChannel existing = nm.getNotificationChannel(ORDERS_CHANNEL_ID);
            if (existing != null) {
                // If the channel is already configured with HIGH importance, do not delete it!
                if (existing.getImportance() >= NotificationManager.IMPORTANCE_HIGH) {
                    return;
                }
                try {
                    nm.deleteNotificationChannel(ORDERS_CHANNEL_ID);
                } catch (Exception ignored) {}
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
            ordersChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            nm.createNotificationChannel(ordersChannel);
        }
    }

    private synchronized void playSirenAuxiliary() {
        try {
            stopAuxiliarySiren();

            // Maximize alarm stream volume
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                am.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
            }

            auxiliaryMediaPlayer = MediaPlayer.create(this, R.raw.order_siren);
            if (auxiliaryMediaPlayer != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    auxiliaryMediaPlayer.setAudioAttributes(attrs);
                } else {
                    auxiliaryMediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                }
                auxiliaryMediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                    @Override
                    public void onCompletion(MediaPlayer player) {
                        try {
                            player.release();
                            if (auxiliaryMediaPlayer == player) {
                                auxiliaryMediaPlayer = null;
                            }
                        } catch (Exception ignored) {}
                    }
                });
                auxiliaryMediaPlayer.start();
                Log.d(TAG, "Auxiliary siren started successfully.");
            }
        } catch (Exception e) {
            Log.w(TAG, "Error playing auxiliary siren", e);
        }
    }

    public static void syncTokenToSupabase(final String accessToken, final String userId, final String role, final String fcmToken) {
        if (fcmToken == null || fcmToken.trim().isEmpty() || accessToken == null || accessToken.trim().isEmpty()) {
            return;
        }

        Log.i(TAG, "REGISTERED_FCM_TOKEN: " + fcmToken);

        new Thread(new Runnable() {
            @Override
            public void run() {
                // Canonical, least-privilege token registration via SECURITY DEFINER register_push_device RPC
                int maxRetries = 2;
                for (int attempt = 1; attempt <= maxRetries; attempt++) {
                    HttpURLConnection conn = null;
                    try {
                        URL rpcUrl = new URL("https://bvacebeorvxwcfkselon.supabase.co/rest/v1/rpc/register_push_device");
                        conn = (HttpURLConnection) rpcUrl.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
                        conn.setRequestProperty("Authorization", "Bearer " + accessToken);
                        conn.setRequestProperty("Content-Type", "application/json");
                        conn.setConnectTimeout(8000);
                        conn.setReadTimeout(8000);
                        conn.setDoOutput(true);

                        JSONObject rpcBody = new JSONObject();
                        rpcBody.put("_token", fcmToken.trim());
                        rpcBody.put("_platform", "android");

                        try (OutputStream os = conn.getOutputStream()) {
                            os.write(rpcBody.toString().getBytes(StandardCharsets.UTF_8));
                        }

                        int rpcCode = conn.getResponseCode();
                        Log.d(TAG, "register_push_device RPC response code: " + rpcCode);
                        if (rpcCode == 204 || (rpcCode >= 200 && rpcCode < 300)) {
                            Log.i(TAG, "register_push_device RPC succeeded (" + rpcCode + "). Device registered in live Supabase.");
                            break;
                        } else {
                            try (java.io.InputStream es = conn.getErrorStream()) {
                                if (es != null) {
                                    java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                                    byte[] buf = new byte[1024];
                                    int n;
                                    while ((n = es.read(buf)) != -1) baos.write(buf, 0, n);
                                    Log.w(TAG, "register_push_device RPC error (" + rpcCode + "): " + baos.toString("UTF-8"));
                                }
                            } catch (Exception ignored) {}
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "RPC register_push_device attempt " + attempt + " error", e);
                    } finally {
                        if (conn != null) conn.disconnect();
                    }

                    if (attempt < maxRetries) {
                        try {
                            Thread.sleep(1500);
                        } catch (InterruptedException ignored) {}
                    }
                }
            }
        }).start();
    }

    public static Bitmap getDrawableBitmap(Context context, int resId) {
        try {
            Drawable drawable = ContextCompat.getDrawable(context, resId);
            if (drawable == null) return null;
            if (drawable instanceof BitmapDrawable) {
                return ((BitmapDrawable) drawable).getBitmap();
            }
            int w = drawable.getIntrinsicWidth() > 0 ? drawable.getIntrinsicWidth() : 192;
            int h = drawable.getIntrinsicHeight() > 0 ? drawable.getIntrinsicHeight() : 192;
            Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
            drawable.draw(canvas);
            return bitmap;
        } catch (Exception e) {
            return null;
        }
    }
}
