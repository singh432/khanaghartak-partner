package in.khanaghartak.partner;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import com.google.android.gms.auth.api.phone.SmsRetriever;
import com.google.android.gms.auth.api.phone.SmsRetrieverClient;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Status;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 2001;
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 2002;
    private static final int SMS_CONSENT_REQUEST = 2003;
    private static final int ALARM_NOTIFICATION_ID = 9991;

    private BroadcastReceiver smsVerificationReceiver;
    private boolean isSmsConsentRegistered = false;

    private MediaPlayer alarmMediaPlayer = null;
    private Vibrator vibrator = null;
    private boolean isAlarmActive = false;

    private String partnerScriptCache = null;

    private String activeAccessToken = null;
    private String activeRole = null;
    private String activeUserId = null;
    private ScheduledExecutorService orderPollerExecutor = null;
    private final Set<String> notifiedOrderIds = Collections.synchronizedSet(new HashSet<String>());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        createNotificationChannels();

        // Ensure status bar is pure white (#FFFFFF) with dark status bar icons and does not overlap app content
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.WHITE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            }
        }

        // Apply WindowInsetsListener so root view adds top padding equal to status bar height
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, insets) -> {
                Insets statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                v.setPadding(0, statusBarInsets.top, 0, 0);
                return insets;
            });
        }

        // Keep screen awake on partner/counter devices
        try {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (Exception ignored) {}

        // Request runtime permissions on launch (Notifications on Android 13+, Location for riders)
        requestPermissionsOnLaunch();

        if (this.bridge != null) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                webView.setBackgroundColor(Color.WHITE);
                try {
                    String ua = webView.getSettings().getUserAgentString();
                    if (!ua.contains("KhanaGharTakPartnerApp")) {
                        webView.getSettings().setUserAgentString(ua + " KhanaGharTakPartnerApp");
                    }
                } catch (Exception ignored) {}
                webView.addJavascriptInterface(new OtpJavascriptInterface(), "AndroidOtp");
                webView.addJavascriptInterface(new AppJavascriptInterface(), "AndroidApp");
                webView.addJavascriptInterface(new AlertJavascriptInterface(), "AndroidAlert");
                webView.post(new Runnable() {
                    @Override
                    public void run() {
                        applyPartnerScripts(bridge.getWebView());
                    }
                });
            }
            this.bridge.addWebViewListener(new WebViewListener() {
                @Override
                public void onPageStarted(WebView webView) {
                    super.onPageStarted(webView);
                    applyPartnerScripts(webView);
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    super.onPageLoaded(webView);
                    try {
                        String ua = webView.getSettings().getUserAgentString();
                        if (!ua.contains("KhanaGharTakPartnerApp")) {
                            webView.getSettings().setUserAgentString(ua + " KhanaGharTakPartnerApp");
                        }
                        webView.addJavascriptInterface(new OtpJavascriptInterface(), "AndroidOtp");
                        webView.addJavascriptInterface(new AppJavascriptInterface(), "AndroidApp");
                        webView.addJavascriptInterface(new AlertJavascriptInterface(), "AndroidAlert");
                    } catch (Exception ignored) {}
                    applyPartnerScripts(webView);
                }

                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    super.onPageCommitVisible(view, url);
                    applyPartnerScripts(view);
                }
            });
        }

        handleIncomingAlertIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingAlertIntent(intent);
    }

    private void handleIncomingAlertIntent(Intent intent) {
        if (intent != null && intent.getBooleanExtra("from_order_alert", false)) {
            final String role = intent.getStringExtra("role");
            stopContinuousAlarm();
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        String targetPath = "/admin/orders";
                        if ("rider".equals(role)) targetPath = "/rider";
                        else if ("zone_manager".equals(role)) targetPath = "/zone";
                        bridge.getWebView().evaluateJavascript(
                            "(function() { " +
                            "  if (typeof window.__kgt_stop_order_alarm === 'function') window.__kgt_stop_order_alarm(); " +
                            "  if (window.location.pathname !== '" + targetPath + "') { " +
                            "    window.location.href = '" + targetPath + "'; " +
                            "  } " +
                            "})();",
                            null
                        );
                    }
                });
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            applyPartnerScripts(this.bridge.getWebView());
        }
    }

    @Override
    public void onBackPressed() {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().evaluateJavascript(
                "(function() { " +
                "  if (typeof window.__kgt_partner_handle_back === 'function') { " +
                "    window.__kgt_partner_handle_back(); " +
                "  } else { " +
                "    var p = window.location.pathname || ''; " +
                "    if (p === '/admin' || p === '/rider' || p === '/zone' || p === '/' || p === '' || p === '/login' || p.indexOf('/login') !== -1) { " +
                "      if (window.AndroidApp) window.AndroidApp.exitApp(); " +
                "    } else { " +
                "      window.history.back(); " +
                "    } " +
                "  } " +
                "})();",
                null
            );
            return;
        }
        super.onBackPressed();
    }

    private void requestPermissionsOnLaunch() {
        // Android 13+ Notification Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST_CODE);
            }
        }

        // Location permission (important for Riders)
        boolean fineGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarseGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fineGranted && !coarseGranted) {
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                LOCATION_PERMISSION_REQUEST_CODE
            );
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // 1. Primary channel for high-priority order and delivery alerts
            CharSequence ordersName = "Orders & Partner Alerts";
            String ordersDesc = "Instant notifications and continuous sirens for new orders and delivery dispatches";
            int ordersImportance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel ordersChannel = new NotificationChannel("orders_channel", ordersName, ordersImportance);
            ordersChannel.setDescription(ordersDesc);
            ordersChannel.enableVibration(true);
            ordersChannel.enableLights(true);
            ordersChannel.setLightColor(Color.parseColor("#F45D2C"));

            // Set alarm audio attributes on Android O+
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build();
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            ordersChannel.setSound(soundUri, audioAttributes);

            // 2. Default fallback channel
            CharSequence defaultName = "General Partner Notifications";
            String defaultDesc = "General account and operational messages";
            NotificationChannel defaultChannel = new NotificationChannel("fcm_default_channel", defaultName, ordersImportance);
            defaultChannel.setDescription(defaultDesc);
            defaultChannel.enableVibration(true);

            notificationManager.createNotificationChannel(ordersChannel);
            notificationManager.createNotificationChannel(defaultChannel);
        }
    }

    // ==========================================
    // ASSET SCRIPT INJECTION
    // ==========================================
    private String getPartnerScript() {
        if (partnerScriptCache != null) return partnerScriptCache;
        try (InputStream is = getAssets().open("partner_injected.js");
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            partnerScriptCache = sb.toString();
            return partnerScriptCache;
        } catch (Exception e) {
            return "";
        }
    }

    private void applyPartnerScripts(WebView webView) {
        if (webView == null) return;
        String script = getPartnerScript();
        if (!script.isEmpty()) {
            webView.evaluateJavascript(script, null);
        }
    }

    // ==========================================
    // CONTINUOUS LOUD ALARM SYSTEM
    // ==========================================
    public synchronized void startContinuousAlarm(String orderId, String role, String title, String body) {
        try {
            isAlarmActive = true;

            // 0. Wake up device screen and illuminate
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    PowerManager.WakeLock wl = pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                        "KhanaGharTak:PartnerOrderWakeLock"
                    );
                    wl.acquire(25000);
                }
            } catch (Exception ignored) {}

            // 1. Boost alarm audio volume
            try {
                AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                    int cur = am.getStreamVolume(AudioManager.STREAM_ALARM);
                    if (cur < max / 2) {
                        am.setStreamVolume(AudioManager.STREAM_ALARM, (int) (max * 0.85), 0);
                    }
                }
            } catch (Exception ignored) {}

            // 2. Looping MediaPlayer on STREAM_ALARM
            if (alarmMediaPlayer == null) {
                Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alertUri == null) {
                    alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
                if (alertUri == null) {
                    alertUri = Settings.System.DEFAULT_ALARM_ALERT_URI;
                }
                if (alertUri == null) {
                    alertUri = Settings.System.DEFAULT_NOTIFICATION_URI;
                }

                alarmMediaPlayer = new MediaPlayer();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    alarmMediaPlayer.setAudioAttributes(attrs);
                } else {
                    alarmMediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                }
                alarmMediaPlayer.setDataSource(getApplicationContext(), alertUri);
                alarmMediaPlayer.setLooping(true);
                alarmMediaPlayer.prepare();
                alarmMediaPlayer.start();
            } else if (!alarmMediaPlayer.isPlaying()) {
                alarmMediaPlayer.start();
            }

            // 3. Loop vibration pattern
            if (vibrator == null) {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = { 0, 800, 400, 800, 400 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)); // 0 = repeat continuous
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }

            // 4. Post Insistent High-Priority Heads-Up Notification
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                Intent intent = new Intent(this, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                intent.putExtra("from_order_alert", true);
                intent.putExtra("order_id", orderId);
                intent.putExtra("role", role);

                int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getActivity(this, ALARM_NOTIFICATION_ID, intent, pendingFlags);

                NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "orders_channel")
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle(title != null && !title.isEmpty() ? title : "🚨 NEW ORDER RECEIVED!")
                        .setContentText(body != null && !body.isEmpty() ? body : "Tap to open and accept order immediately.")
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_ALARM)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setFullScreenIntent(pendingIntent, true)
                        .setOngoing(true)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent);

                Notification notif = builder.build();
                // FLAG_INSISTENT repeats audio until notification is handled
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

    public synchronized void updateSession(String accessToken, String role, String userId) {
        if (accessToken == null || accessToken.trim().isEmpty()) {
            stopOrderPoller();
            activeAccessToken = null;
            activeRole = null;
            activeUserId = null;
            return;
        }
        boolean changed = !accessToken.equals(activeAccessToken) || (role != null && !role.equalsIgnoreCase(activeRole));
        this.activeAccessToken = accessToken;
        this.activeRole = (role != null && !role.isEmpty()) ? role.toLowerCase() : "restaurant";
        this.activeUserId = userId;
        if (changed || orderPollerExecutor == null || orderPollerExecutor.isShutdown()) {
            startOrderPoller();
        }
    }

    private synchronized void startOrderPoller() {
        if (orderPollerExecutor != null && !orderPollerExecutor.isShutdown()) {
            return;
        }
        orderPollerExecutor = Executors.newSingleThreadScheduledExecutor();
        orderPollerExecutor.scheduleWithFixedDelay(new Runnable() {
            @Override
            public void run() {
                try {
                    pollSupabaseOrders();
                } catch (Exception ignored) {}
            }
        }, 1, 4, TimeUnit.SECONDS);
    }

    private synchronized void stopOrderPoller() {
        if (orderPollerExecutor != null) {
            orderPollerExecutor.shutdownNow();
            orderPollerExecutor = null;
        }
    }

    private void pollSupabaseOrders() {
        final String token = activeAccessToken;
        final String role = activeRole != null ? activeRole : "restaurant";
        if (token == null || token.trim().isEmpty()) return;

        HttpURLConnection conn = null;
        try {
            String rpcName = "rider".equals(role) ? "rider_list_offers" : "owner_list_orders";
            URL url = new URL("https://bvacebeorvxwcfkselon.supabase.co/rest/v1/rpc/" + rpcName);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoOutput(true);

            String jsonInput = "{\"_limit\":10}";
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
                    processPollerResponse(response.toString(), role);
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void processPollerResponse(String jsonString, String role) {
        try {
            JSONArray array = new JSONArray(jsonString);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if ("rider".equals(role)) {
                    String orderId = obj.optString("order_id", obj.optString("id", ""));
                    String status = obj.optString("status", "");
                    if (status.isEmpty() || "active".equals(status)) {
                        if (!notifiedOrderIds.contains(orderId)) {
                            notifiedOrderIds.add(orderId);
                            final String oId = orderId;
                            final String drop = obj.optString("drop_area", "Nearby");
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    startContinuousAlarm(
                                        oId,
                                        "rider",
                                        "🛵 NEW DELIVERY OFFER!",
                                        "Drop: " + drop + " · Tap to accept!"
                                    );
                                }
                            });
                        }
                        break;
                    }
                } else {
                    String orderId = obj.optString("id", "");
                    String status = obj.optString("status", "");
                    if ("placed".equalsIgnoreCase(status) || "pending".equalsIgnoreCase(status)) {
                        if (!notifiedOrderIds.contains(orderId)) {
                            notifiedOrderIds.add(orderId);
                            final String oId = orderId;
                            final double total = obj.optDouble("total", 0.0);
                            final String shortId = oId.length() >= 8 ? oId.substring(0, 8).toUpperCase() : oId;
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    startContinuousAlarm(
                                        oId,
                                        "restaurant",
                                        "🚨 NEW ORDER RECEIVED!",
                                        "Order #" + shortId + " · ₹" + ((int) Math.round(total)) + " · Tap to view and accept!"
                                    );
                                }
                            });
                        }
                        break;
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    public class AlertJavascriptInterface {
        @JavascriptInterface
        public void startContinuousAlarm(final String orderId, final String role, final String title, final String body) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.startContinuousAlarm(orderId, role, title, body);
                }
            });
        }

        @JavascriptInterface
        public void stopContinuousAlarm() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.stopContinuousAlarm();
                }
            });
        }

        @JavascriptInterface
        public boolean isAlarmActive() {
            return isAlarmActive;
        }

        @JavascriptInterface
        public void syncSession(final String accessToken, final String role, final String userId) {
            MainActivity.this.updateSession(accessToken, role, userId);
        }

        @JavascriptInterface
        public void testAlarm() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.startContinuousAlarm(
                        "TEST-ORDER-1234",
                        "restaurant",
                        "🔔 TEST ORDER ALARM",
                        "This is a loud test alarm! Sound and vibration are active. Tap to silence."
                    );
                }
            });
        }
    }

    // ==========================================
    // APP LIFECYCLE INTERFACE
    // ==========================================
    public class AppJavascriptInterface {
        @JavascriptInterface
        public void setKeepScreenOn(final boolean keepOn) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (keepOn) {
                            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                        } else {
                            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        finishAffinity();
                    } catch (Exception e) {
                        finish();
                    }
                }
            });
        }
    }

    // ==========================================
    // SMS RETRIEVER / OTP AUTO-FILL API
    // ==========================================
    public class OtpJavascriptInterface {
        @JavascriptInterface
        public void startSmsConsent() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startSmsUserConsent();
                }
            });
        }
    }

    private void startSmsUserConsent() {
        try {
            SmsRetrieverClient client = SmsRetriever.getClient(this);
            client.startSmsUserConsent(null);
            registerSmsReceiver();
        } catch (Exception ignored) {}
    }

    private void registerSmsReceiver() {
        if (isSmsConsentRegistered) return;
        smsVerificationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (SmsRetriever.SMS_RETRIEVED_ACTION.equals(intent.getAction())) {
                    Bundle extras = intent.getExtras();
                    if (extras != null) {
                        Status status = (Status) extras.get(SmsRetriever.EXTRA_STATUS);
                        if (status != null) {
                            switch (status.getStatusCode()) {
                                case CommonStatusCodes.SUCCESS:
                                    Intent consentIntent = extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT);
                                    try {
                                        startActivityForResult(consentIntent, SMS_CONSENT_REQUEST);
                                    } catch (ActivityNotFoundException ignored) {}
                                    break;
                                case CommonStatusCodes.TIMEOUT:
                                    break;
                            }
                        }
                    }
                }
            }
        };

        IntentFilter intentFilter = new IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(this, smsVerificationReceiver, intentFilter, ContextCompat.RECEIVER_EXPORTED);
        } else {
            registerReceiver(smsVerificationReceiver, intentFilter);
        }
        isSmsConsentRegistered = true;
    }

    private void unregisterSmsReceiver() {
        if (isSmsConsentRegistered && smsVerificationReceiver != null) {
            try {
                unregisterReceiver(smsVerificationReceiver);
            } catch (Exception ignored) {}
            isSmsConsentRegistered = false;
        }
    }

    @Override
    public void onDestroy() {
        stopContinuousAlarm();
        stopOrderPoller();
        unregisterSmsReceiver();
        super.onDestroy();
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SMS_CONSENT_REQUEST) {
            if (resultCode == RESULT_OK && data != null) {
                String message = data.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE);
                if (message != null) {
                    extractAndAutoFillOtp(message);
                }
            }
        }
    }

    private void extractAndAutoFillOtp(String message) {
        String otp = null;
        Matcher m1 = Pattern.compile("(?i)(?:otp|code|pin|verification|login)[^0-9]*?([0-9]{4})").matcher(message);
        if (m1.find()) {
            otp = m1.group(1);
        } else {
            Matcher m2 = Pattern.compile("(?<![0-9])([0-9]{4})(?![0-9])").matcher(message);
            if (m2.find()) {
                otp = m2.group(1);
            } else {
                Matcher m3 = Pattern.compile("(?<![0-9])([0-9]{6})(?![0-9])").matcher(message);
                if (m3.find()) {
                    otp = m3.group(1);
                }
            }
        }

        if (otp != null && this.bridge != null && this.bridge.getWebView() != null) {
            final String finalOtp = otp;
            this.bridge.getWebView().post(new Runnable() {
                @Override
                public void run() {
                    injectOtpIntoWebView(finalOtp);
                }
            });
        }
    }

    private void injectOtpIntoWebView(String otp) {
        String js = String.format(Locale.US,
            "(function() {" +
            "  var otp = '%s';" +
            "  if (typeof window.__kgt_set_otp === 'function') {" +
            "    try { window.__kgt_set_otp(otp); } catch(e){}" +
            "  }" +
            "  var partnerOtp = document.getElementById('partner-input-otp');" +
            "  if (partnerOtp) {" +
            "    partnerOtp.value = otp;" +
            "    partnerOtp.dispatchEvent(new Event('input', { bubbles: true }));" +
            "    partnerOtp.dispatchEvent(new Event('change', { bubbles: true }));" +
            "    setTimeout(function() {" +
            "      var vBtn = document.getElementById('partner-btn-verify-otp');" +
            "      if (vBtn && !vBtn.disabled) vBtn.click();" +
            "    }, 300);" +
            "  }" +
            "  function fill() {" +
            "    var inputs = document.querySelectorAll('input');" +
            "    var targetInput = null;" +
            "    for (var i = 0; i < inputs.length; i++) {" +
            "      var inp = inputs[i];" +
            "      var placeholder = inp.getAttribute('placeholder') || '';" +
            "      var maxLen = inp.getAttribute('maxlength') || '';" +
            "      var cls = inp.className || '';" +
            "      if (placeholder.indexOf('____') !== -1 || maxLen === '4' || maxLen === '6' || cls.indexOf('ck-input') !== -1) {" +
            "        targetInput = inp;" +
            "        break;" +
            "      }" +
            "    }" +
            "    if (!targetInput) {" +
            "      for (var j = 0; j < inputs.length; j++) {" +
            "        var input = inputs[j];" +
            "        if (input.getAttribute('inputmode') === 'numeric' && input.value.length < 10) {" +
            "          targetInput = input;" +
            "          break;" +
            "        }" +
            "      }" +
            "    }" +
            "    if (targetInput) {" +
            "      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;" +
            "      if (setter) { setter.call(targetInput, otp); } else { targetInput.value = otp; }" +
            "      targetInput.dispatchEvent(new Event('input', { bubbles: true }));" +
            "      targetInput.dispatchEvent(new Event('change', { bubbles: true }));" +
            "      setTimeout(function() {" +
            "        var btns = document.querySelectorAll('button');" +
            "        for (var b = 0; b < btns.length; b++) {" +
            "          var btn = btns[b];" +
            "          var txt = (btn.textContent || '').trim().toLowerCase();" +
            "          if (txt.indexOf('verify') !== -1 && !btn.disabled) {" +
            "            btn.click();" +
            "            break;" +
            "          }" +
            "        }" +
            "      }, 400);" +
            "      return true;" +
            "    }" +
            "    return false;" +
            "  }" +
            "  if (!fill()) {" +
            "    var attempts = 0;" +
            "    var interval = setInterval(function() {" +
            "      attempts++;" +
            "      if (fill() || attempts > 10) { clearInterval(interval); }" +
            "    }, 300);" +
            "  }" +
            "})();",
            otp
        );
        this.bridge.getWebView().evaluateJavascript(js, null);
    }
}
