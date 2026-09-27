package in.khanaghartak.partner;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class PartnerForegroundService extends Service {
    public static final String ACTION_START = "in.khanaghartak.partner.action.START";
    public static final String ACTION_STOP = "in.khanaghartak.partner.action.STOP";
    public static final String ACTION_SILENCE = "in.khanaghartak.partner.action.SILENCE";
    public static final String ACTION_ORDER_ALERT = "in.khanaghartak.partner.action.ORDER_ALERT";

    public static final String CHANNEL_SERVICE = "partner_service_channel";
    public static final String CHANNEL_ORDERS = "orders_channel";
    public static final int SERVICE_NOTIFICATION_ID = 9990;
    public static final int ALARM_NOTIFICATION_ID = 9991;

    private MediaPlayer alarmMediaPlayer = null;
    private Vibrator vibrator = null;
    private boolean isAlarmActive = false;
    private ScheduledExecutorService pollerExecutor = null;
    private final Set<String> notifiedOrderIds = Collections.synchronizedSet(new HashSet<String>());

    public static void startService(Context context) {
        try {
            Intent intent = new Intent(context, PartnerForegroundService.class);
            intent.setAction(ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception ignored) {}
    }

    public static void stopService(Context context) {
        try {
            Intent intent = new Intent(context, PartnerForegroundService.class);
            intent.setAction(ACTION_STOP);
            context.startService(intent);
        } catch (Exception ignored) {}
    }

    public static void silenceAlarm(Context context) {
        try {
            Intent intent = new Intent(context, PartnerForegroundService.class);
            intent.setAction(ACTION_SILENCE);
            context.startService(intent);
        } catch (Exception ignored) {}
    }

    public static void triggerAlarm(Context context, String orderId, String role, String title, String body) {
        try {
            Intent intent = new Intent(context, PartnerForegroundService.class);
            intent.setAction(ACTION_ORDER_ALERT);
            intent.putExtra("order_id", orderId);
            intent.putExtra("role", role);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            stopContinuousAlarm();
            stopPoller();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            stopSelf();
            return START_NOT_STICKY;
        } else if (ACTION_SILENCE.equals(action)) {
            stopContinuousAlarm();
            return START_STICKY;
        } else if (ACTION_ORDER_ALERT.equals(action)) {
            String orderId = intent.getStringExtra("order_id");
            String role = intent.getStringExtra("role");
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            startContinuousAlarm(orderId, role, title, body);
            return START_STICKY;
        }

        // Default or ACTION_START: build ongoing notification and start polling
        createNotificationChannels();
        Notification foregroundNotification = buildForegroundNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(SERVICE_NOTIFICATION_ID, foregroundNotification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(SERVICE_NOTIFICATION_ID, foregroundNotification);
        }

        startPoller();
        return START_STICKY;
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // 1. Silent persistent background service channel
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_SERVICE,
                "Partner Background Sync",
                NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Keeps partner order detection active when the app is closed or screen is off");
            serviceChannel.setShowBadge(false);
            serviceChannel.enableVibration(false);
            nm.createNotificationChannel(serviceChannel);

            // 2. High priority urgent orders channel for alarms
            NotificationChannel ordersChannel = new NotificationChannel(
                CHANNEL_ORDERS,
                "Orders & Partner Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            ordersChannel.setDescription("Instant continuous alarm notifications for new incoming orders");
            ordersChannel.enableVibration(true);
            ordersChannel.enableLights(true);
            ordersChannel.setLightColor(Color.parseColor("#F45D2C"));

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build();
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            ordersChannel.setSound(soundUri, audioAttributes);
            nm.createNotificationChannel(ordersChannel);
        }
    }

    private Notification buildForegroundNotification() {
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 1001, mainIntent, flags);

        return new NotificationCompat.Builder(this, CHANNEL_SERVICE)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("KhanaGharTak Partner Online")
                .setContentText("Listening for incoming orders in real time")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .build();
    }

    private synchronized void startPoller() {
        if (pollerExecutor != null && !pollerExecutor.isShutdown()) return;
        pollerExecutor = Executors.newSingleThreadScheduledExecutor();
        pollerExecutor.scheduleWithFixedDelay(new Runnable() {
            @Override
            public void run() {
                try {
                    pollSupabaseOrders();
                } catch (Exception ignored) {}
            }
        }, 1, 3500, TimeUnit.MILLISECONDS);
    }

    private synchronized void stopPoller() {
        if (pollerExecutor != null) {
            pollerExecutor.shutdownNow();
            pollerExecutor = null;
        }
    }

    private void pollSupabaseOrders() {
        SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
        String token = prefs.getString("access_token", null);
        String role = prefs.getString("role", "restaurant");

        if (token == null || token.trim().isEmpty()) {
            return;
        }

        String lowerRole = (role != null) ? role.toLowerCase() : "restaurant";

        if ("rider".equals(lowerRole)) {
            pollRiderOffers(token);
        } else if (lowerRole.contains("zone") || lowerRole.contains("manager")) {
            pollZoneOrders(token, prefs);
        } else {
            pollRestaurantOrders(token);
        }
    }

    private void pollRiderOffers(String token) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://bvacebeorvxwcfkselon.supabase.co/rest/v1/rpc/rider_list_offers");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoOutput(true);

            // rider_list_offers takes 0 arguments in Postgres - must send empty JSON object {}
            try (OutputStream os = conn.getOutputStream()) {
                os.write("{}".getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code == 200) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) {
                        response.append(line);
                    }
                    JSONArray array = new JSONArray(response.toString());
                    int activeOffers = 0;
                    for (int i = 0; i < array.length(); i++) {
                        JSONObject obj = array.getJSONObject(i);
                        String status = obj.optString("status", "");
                        if (status.isEmpty() || "active".equalsIgnoreCase(status)) {
                            activeOffers++;
                            String orderId = obj.optString("order_id", obj.optString("id", ""));
                            if (!orderId.isEmpty() && !notifiedOrderIds.contains(orderId)) {
                                notifiedOrderIds.add(orderId);
                                String drop = obj.optString("drop_area", "Customer Delivery");
                                double total = obj.optDouble("total", 0.0);
                                startContinuousAlarm(
                                    orderId,
                                    "rider",
                                    "🛵 NEW DELIVERY OFFER!",
                                    "Drop: " + drop + " · ₹" + ((int) Math.round(total)) + " · Tap to Accept!"
                                );
                            }
                        }
                    }
                    // Auto-silence when offers are accepted or rejected or gone
                    if (activeOffers == 0 && isAlarmActive) {
                        stopContinuousAlarm();
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void pollZoneOrders(String token, SharedPreferences prefs) {
        String zoneId = prefs.getString("zone_id", null);
        if (zoneId == null || zoneId.trim().isEmpty()) {
            zoneId = fetchZoneId(token);
            if (zoneId != null && !zoneId.trim().isEmpty()) {
                prefs.edit().putString("zone_id", zoneId).apply();
            }
        }
        if (zoneId == null || zoneId.trim().isEmpty()) return;

        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://bvacebeorvxwcfkselon.supabase.co/rest/v1/rpc/zone_list_orders");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoOutput(true);

            String payload = "{\"_zone_id\":\"" + zoneId + "\",\"_limit\":25}";
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload.getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code == 200) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) {
                        response.append(line);
                    }
                    JSONArray array = new JSONArray(response.toString());
                    int pendingCount = 0;
                    for (int i = 0; i < array.length(); i++) {
                        JSONObject obj = array.getJSONObject(i);
                        String status = obj.optString("status", "");
                        String riderId = obj.optString("rider_id", "");
                        if ("placed".equalsIgnoreCase(status) || ("pending".equalsIgnoreCase(status) && (riderId.isEmpty() || "null".equals(riderId)))) {
                            pendingCount++;
                            String orderId = obj.optString("id", "");
                            if (!orderId.isEmpty() && !notifiedOrderIds.contains(orderId)) {
                                notifiedOrderIds.add(orderId);
                                double total = obj.optDouble("total", 0.0);
                                String shortId = orderId.length() >= 8 ? orderId.substring(0, 8).toUpperCase() : orderId;
                                startContinuousAlarm(
                                    orderId,
                                    "zone_manager",
                                    "📦 NEW ZONE ORDER!",
                                    "Order #" + shortId + " · ₹" + ((int) Math.round(total)) + " · Tap to dispatch!"
                                );
                            }
                        }
                    }
                    // Auto-silence when orders are assigned or accepted
                    if (pendingCount == 0 && isAlarmActive) {
                        stopContinuousAlarm();
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String fetchZoneId(String token) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://bvacebeorvxwcfkselon.supabase.co/rest/v1/rpc/zone_my_zones");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write("{}".getBytes(StandardCharsets.UTF_8));
            }
            if (conn.getResponseCode() == 200) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) response.append(line);
                    JSONArray arr = new JSONArray(response.toString());
                    if (arr.length() > 0) {
                        return arr.getJSONObject(0).optString("id", null);
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private void pollRestaurantOrders(String token) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://bvacebeorvxwcfkselon.supabase.co/rest/v1/rpc/owner_list_orders");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoOutput(true);

            String jsonInput = "{\"_limit\":20}";
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonInput.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            if (code == 200) {
                try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) {
                        response.append(line);
                    }
                    JSONArray array = new JSONArray(response.toString());
                    int placedCount = 0;
                    for (int i = 0; i < array.length(); i++) {
                        JSONObject obj = array.getJSONObject(i);
                        String status = obj.optString("status", "");
                        if ("placed".equalsIgnoreCase(status) || "pending".equalsIgnoreCase(status)) {
                            placedCount++;
                            String orderId = obj.optString("id", "");
                            if (!orderId.isEmpty() && !notifiedOrderIds.contains(orderId)) {
                                notifiedOrderIds.add(orderId);
                                double total = obj.optDouble("total", 0.0);
                                String shortId = orderId.length() >= 8 ? orderId.substring(0, 8).toUpperCase() : orderId;
                                startContinuousAlarm(
                                    orderId,
                                    "restaurant",
                                    "🚨 NEW ORDER RECEIVED!",
                                    "Order #" + shortId + " · ₹" + ((int) Math.round(total)) + " · Tap to view and accept!"
                                );
                            }
                        }
                    }
                    // Auto-silence when orders are accepted or rejected
                    if (placedCount == 0 && isAlarmActive) {
                        stopContinuousAlarm();
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    public synchronized void startContinuousAlarm(String orderId, String role, String title, String body) {
        try {
            isAlarmActive = true;

            // 1. Wake up and illuminate screen (screen is turned ON even when phone is locked or screen off)
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    PowerManager.WakeLock wl = pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                        "KhanaGharTak:PartnerOrderWakeLock"
                    );
                    wl.acquire(30000);
                }
            } catch (Exception ignored) {}

            // 2. Maximize volume on STREAM_ALARM (loud and clear 100%)
            try {
                AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                    am.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
                }
            } catch (Exception ignored) {}

            // 3. Play continuous loud looping siren from R.raw.order_siren
            if (alarmMediaPlayer == null) {
                try {
                    alarmMediaPlayer = MediaPlayer.create(this, R.raw.order_siren);
                    if (alarmMediaPlayer != null) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            AudioAttributes attrs = new AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_ALARM)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .build();
                            alarmMediaPlayer.setAudioAttributes(attrs);
                        } else {
                            alarmMediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                        }
                        alarmMediaPlayer.setLooping(true);
                        alarmMediaPlayer.start();
                    }
                } catch (Exception e) {
                    try {
                        Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                        if (alertUri == null) alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                        if (alertUri == null) alertUri = Settings.System.DEFAULT_ALARM_ALERT_URI;
                        alarmMediaPlayer = new MediaPlayer();
                        alarmMediaPlayer.setDataSource(this, alertUri);
                        alarmMediaPlayer.setLooping(true);
                        alarmMediaPlayer.prepare();
                        alarmMediaPlayer.start();
                    } catch (Exception ignored) {}
                }
            } else if (!alarmMediaPlayer.isPlaying()) {
                alarmMediaPlayer.start();
            }

            // 4. Continuous repeating vibration
            if (vibrator == null) {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = { 0, 800, 400, 800, 400 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }

            // 5. Post Insistent High-Priority Heads-Up / Full-Screen Notification
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                Intent mainIntent = new Intent(this, MainActivity.class);
                mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                mainIntent.putExtra("from_order_alert", true);
                mainIntent.putExtra("order_id", orderId);
                mainIntent.putExtra("role", role);

                int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent contentIntent = PendingIntent.getActivity(this, ALARM_NOTIFICATION_ID, mainIntent, pendingFlags);

                Intent silenceIntent = new Intent(this, PartnerForegroundService.class);
                silenceIntent.setAction(ACTION_SILENCE);
                PendingIntent silencePendingIntent = PendingIntent.getService(this, 1002, silenceIntent, pendingFlags);

                NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ORDERS)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle(title != null && !title.isEmpty() ? title : "🚨 NEW ORDER RECEIVED!")
                        .setContentText(body != null && !body.isEmpty() ? body : "Tap to open and accept order immediately.")
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_ALARM)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setFullScreenIntent(contentIntent, true)
                        .setContentIntent(contentIntent)
                        .setAutoCancel(true)
                        .setOngoing(true)
                        .addAction(R.mipmap.ic_launcher, "✕ Silence", silencePendingIntent)
                        .addAction(R.mipmap.ic_launcher, "View & Accept", contentIntent);

                Notification notif = builder.build();
                notif.flags |= Notification.FLAG_INSISTENT;
                nm.notify(ALARM_NOTIFICATION_ID, notif);
            }
        } catch (Exception ignored) {}
    }

    public synchronized void stopContinuousAlarm() {
        isAlarmActive = false;
        try {
            if (alarmMediaPlayer != null) {
                if (alarmMediaPlayer.isPlaying()) {
                    alarmMediaPlayer.stop();
                }
                alarmMediaPlayer.release();
                alarmMediaPlayer = null;
            }
        } catch (Exception ignored) {}

        try {
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception ignored) {}

        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(ALARM_NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        stopContinuousAlarm();
        stopPoller();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
