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
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RelativeLayout;
import android.widget.Space;
import android.widget.TextView;
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
import android.content.ContentResolver;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import android.util.Log;
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
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 2001;
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 2002;
    private static final int SMS_CONSENT_REQUEST = 2003;
    private static final int ALARM_NOTIFICATION_ID = 9991;

    private static MainActivity instance = null;
    private static boolean isForeground = false;

    public static MainActivity getInstance() {
        return instance;
    }

    public static boolean isAppInForeground() {
        return isForeground;
    }

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
        instance = this;

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

        // Initialize branded native loading overlay so users never see a blank white screen
        initLoadingOverlay();

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
                    isPageLoaded = false;
                    applyPartnerScripts(webView);
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    super.onPageLoaded(webView);
                    isPageLoaded = true;
                    try {
                        String ua = webView.getSettings().getUserAgentString();
                        if (!ua.contains("KhanaGharTakPartnerApp")) {
                            webView.getSettings().setUserAgentString(ua + " KhanaGharTakPartnerApp");
                        }
                    } catch (Exception ignored) {}
                    applyPartnerScripts(webView);
                    hideLoadingOverlay();
                    if (pendingAlertOrderId != null || pendingAlertRole != null) {
                        dispatchPendingAlertNavigation();
                    }
                }

                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    super.onPageCommitVisible(view, url);
                    applyPartnerScripts(view);
                    hideLoadingOverlay();
                }

                @Override
                public void onReceivedError(WebView webView) {
                    super.onReceivedError(webView);
                    if (!isPageLoaded) {
                        showLoadingError("Failed to reach Partner Portal. Please check your internet connection.");
                    }
                }

                @Override
                public void onReceivedHttpError(WebView webView) {
                    super.onReceivedHttpError(webView);
                    // Do not block UI on background or subresource HTTP errors (e.g. 404 image/favicon)
                    Log.w(TAG, "WebView onReceivedHttpError ignored for background resource");
                }
            });
        }

        // Request battery optimization exemption so background order detection is never killed
        requestBatteryOptimizationExemption();

        // Restore active session if present
        try {
            SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
            String savedToken = prefs.getString("access_token", null);
            if (savedToken != null && !savedToken.trim().isEmpty()) {
                this.activeAccessToken = savedToken;
                this.activeRole = prefs.getString("role", "restaurant");
                this.activeUserId = prefs.getString("user_id", null);
                startOrderPoller();

                // Proactively refresh FCM token and register with Supabase push_devices
                final String curAccessToken = this.activeAccessToken;
                final String curUserId = this.activeUserId;
                final String curRole = this.activeRole;
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                    if (task.isSuccessful() && task.getResult() != null) {
                        String fcmToken = task.getResult();
                        prefs.edit().putString("fcm_token", fcmToken).apply();
                        PartnerFirebaseMessagingService.syncTokenToSupabase(curAccessToken, curUserId, curRole, fcmToken);
                    }
                });
            }
        } catch (Exception ignored) {}

        handleIncomingAlertIntent(getIntent());
    }

    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
                boolean alreadyPrompted = prefs.getBoolean("battery_opt_prompted", false);
                if (alreadyPrompted) return;

                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    prefs.edit().putBoolean("battery_opt_prompted", true).apply();
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } else if (pm != null && pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    prefs.edit().putBoolean("battery_opt_prompted", true).apply();
                }
            } catch (Exception ignored) {}
        }
    }

    private String pendingAlertOrderId = null;
    private String pendingAlertRole = null;
    private boolean isPageLoaded = false;
    private View loadingOverlayView = null;
    private TextView loadingStatusText = null;
    private Button retryButton = null;

    private void initLoadingOverlay() {
        ViewGroup root = (ViewGroup) findViewById(android.R.id.content);
        if (root == null) return;

        RelativeLayout overlay = new RelativeLayout(this);
        overlay.setLayoutParams(new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT,
                RelativeLayout.LayoutParams.MATCH_PARENT));
        overlay.setBackgroundColor(Color.WHITE);
        overlay.setClickable(true);

        LinearLayout centerLayout = new LinearLayout(this);
        centerLayout.setOrientation(LinearLayout.VERTICAL);
        centerLayout.setGravity(Gravity.CENTER);
        RelativeLayout.LayoutParams centerParams = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.WRAP_CONTENT,
                RelativeLayout.LayoutParams.WRAP_CONTENT);
        centerParams.addRule(RelativeLayout.CENTER_IN_PARENT, RelativeLayout.TRUE);
        centerLayout.setLayoutParams(centerParams);

        // App Logo
        ImageView logoView = new ImageView(this);
        int logoSizePx = (int) (100 * getResources().getDisplayMetrics().density);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(logoSizePx, logoSizePx);
        logoView.setLayoutParams(logoParams);
        Bitmap logoBmp = PartnerFirebaseMessagingService.getDrawableBitmap(this, R.drawable.ic_kgt_brand_logo);
        if (logoBmp != null) {
            logoView.setImageBitmap(logoBmp);
        } else {
            logoView.setImageResource(R.drawable.splash);
        }
        centerLayout.addView(logoView);

        // Spacer
        Space space1 = new Space(this);
        space1.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (int) (24 * getResources().getDisplayMetrics().density)));
        centerLayout.addView(space1);

        // Orange Spinner
        ProgressBar spinner = new ProgressBar(this);
        int spinnerSizePx = (int) (40 * getResources().getDisplayMetrics().density);
        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(spinnerSizePx, spinnerSizePx);
        spinner.setLayoutParams(spinnerParams);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            spinner.setIndeterminateTintList(ColorStateList.valueOf(Color.parseColor("#F45D2C")));
        }
        centerLayout.addView(spinner);

        // Spacer
        Space space2 = new Space(this);
        space2.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (int) (16 * getResources().getDisplayMetrics().density)));
        centerLayout.addView(space2);

        // App Title
        TextView titleText = new TextView(this);
        titleText.setText("KhanaGharTak Partner");
        titleText.setTextColor(Color.parseColor("#0F172A"));
        titleText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        titleText.setTypeface(Typeface.DEFAULT_BOLD);
        titleText.setGravity(Gravity.CENTER);
        centerLayout.addView(titleText);

        // Status Text
        loadingStatusText = new TextView(this);
        loadingStatusText.setText("Opening Partner Portal...");
        loadingStatusText.setTextColor(Color.parseColor("#64748B"));
        loadingStatusText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        loadingStatusText.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        statusParams.topMargin = (int) (6 * getResources().getDisplayMetrics().density);
        loadingStatusText.setLayoutParams(statusParams);
        centerLayout.addView(loadingStatusText);

        // Retry Button
        retryButton = new Button(this);
        retryButton.setText("Tap to Retry");
        retryButton.setTextColor(Color.WHITE);
        retryButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        retryButton.setTypeface(Typeface.DEFAULT_BOLD);
        retryButton.setBackgroundColor(Color.parseColor("#F45D2C"));
        retryButton.setVisibility(View.GONE);
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        btnParams.topMargin = (int) (20 * getResources().getDisplayMetrics().density);
        retryButton.setLayoutParams(btnParams);
        retryButton.setOnClickListener(v -> {
            retryButton.setVisibility(View.GONE);
            loadingStatusText.setText("Reconnecting...");
            loadingStatusText.setTextColor(Color.parseColor("#64748B"));
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().reload();
            }
        });
        centerLayout.addView(retryButton);

        overlay.addView(centerLayout);
        root.addView(overlay);
        loadingOverlayView = overlay;

        // Safety timeout: if page hasn't loaded after 15 seconds, show retry option
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!isPageLoaded && loadingOverlayView != null && loadingOverlayView.getVisibility() == View.VISIBLE) {
                showLoadingError("Taking longer than usual to load.");
            }
        }, 15000);
    }

    private void hideLoadingOverlay() {
        if (loadingOverlayView != null && loadingOverlayView.getVisibility() == View.VISIBLE) {
            loadingOverlayView.animate()
                    .alpha(0f)
                    .setDuration(250)
                    .withEndAction(() -> {
                        if (loadingOverlayView != null) {
                            loadingOverlayView.setVisibility(View.GONE);
                            loadingOverlayView.setAlpha(1f);
                        }
                    });
        }
    }

    private void showLoadingError(String message) {
        if (loadingOverlayView != null) {
            loadingOverlayView.setVisibility(View.VISIBLE);
            loadingOverlayView.setAlpha(1f);
            if (loadingStatusText != null) {
                loadingStatusText.setText(message != null ? message : "Unable to reach Partner Portal. Please check your connection.");
                loadingStatusText.setTextColor(Color.parseColor("#DC2626"));
            }
            if (retryButton != null) {
                retryButton.setVisibility(View.VISIBLE);
            }
        }
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
            final String orderId = intent.getStringExtra("order_id");
            stopContinuousAlarm();
            PartnerFirebaseMessagingService.stopAuxiliarySiren();

            this.pendingAlertOrderId = orderId;
            this.pendingAlertRole = role;
            if (isPageLoaded) {
                dispatchPendingAlertNavigation();
            }
        }
    }

    private void dispatchPendingAlertNavigation() {
        if (pendingAlertOrderId == null && pendingAlertRole == null) return;
        final String role = pendingAlertRole;
        final String orderId = pendingAlertOrderId;

        // CRITICAL: Consume the pending alert immediately so it can never re-trigger in a loop!
        this.pendingAlertOrderId = null;
        this.pendingAlertRole = null;

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().post(new Runnable() {
                @Override
                public void run() {
                    String cleanId = orderId != null ? orderId.trim() : "";
                    String cleanRole = role != null ? role.trim() : "";

                    String targetBase = "/admin/orders";
                    if ("rider".equals(cleanRole)) targetBase = "/rider";
                    else if ("zone_manager".equals(cleanRole) || "manager".equals(cleanRole)) targetBase = "/zone";

                    String targetPath = targetBase;
                    if (!cleanId.isEmpty()) {
                        targetPath += "?orderId=" + Uri.encode(cleanId);
                    }

                    String js = "(function() { " +
                        "  try { " +
                        "    if (typeof window.__kgt_stop_order_alarm === 'function') window.__kgt_stop_order_alarm(); " +
                        "    var targetBase = '" + targetBase + "'; " +
                        "    var targetPath = '" + targetPath + "'; " +
                        "    var orderId = '" + cleanId + "'; " +
                        "    var role = '" + cleanRole + "'; " +
                        "    if (typeof window.__kgt_navigate_to_order === 'function') { " +
                        "      window.__kgt_navigate_to_order(role, orderId); " +
                        "      return; " +
                        "    } " +
                        "    if (window.location.pathname === targetBase) { " +
                        "      if (typeof window.__kgt_open_zone_order === 'function' && window.__kgt_open_zone_order(orderId)) return; " +
                        "      if (typeof window.__kgt_open_partner_order === 'function' && window.__kgt_open_partner_order(orderId)) return; " +
                        "      if (typeof window.__kgt_open_rider_order === 'function' && window.__kgt_open_rider_order(orderId)) return; " +
                        "    } " +
                        "    if (window.__kgt_router && typeof window.__kgt_router.navigate === 'function') { " +
                        "      window.__kgt_router.navigate({ to: targetBase, search: orderId ? { orderId: orderId } : {} }); " +
                        "      return; " +
                        "    } " +
                        "    if (window.history && window.history.pushState) { " +
                        "      window.history.pushState(null, '', targetPath); " +
                        "      window.dispatchEvent(new PopStateEvent('popstate')); " +
                        "      return; " +
                        "    } " +
                        "    if (window.location.pathname !== targetBase) { " +
                        "      window.location.href = targetPath; " +
                        "    } " +
                        "  } catch(e) { " +
                        "    try { " +
                        "      if (window.location.pathname !== '" + targetBase + "') { " +
                        "        window.location.href = '" + targetPath + "'; " +
                        "      } " +
                        "    } catch(err) {} " +
                        "  } " +
                        "})();";
                    bridge.getWebView().evaluateJavascript(js, null);
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        instance = this;
        isForeground = true;
        stopContinuousAlarm();
        if (this.activeAccessToken != null && !this.activeAccessToken.trim().isEmpty()) {
            startOrderPoller();

            final String curAccessToken = this.activeAccessToken;
            final String curUserId = this.activeUserId;
            final String curRole = this.activeRole;
            final SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (task.isSuccessful() && task.getResult() != null) {
                    String fcmToken = task.getResult();
                    prefs.edit().putString("fcm_token", fcmToken).apply();
                    PartnerFirebaseMessagingService.syncTokenToSupabase(curAccessToken, curUserId, curRole, fcmToken);
                }
            });
        }
        if (this.bridge != null && this.bridge.getWebView() != null) {
            applyPartnerScripts(this.bridge.getWebView());
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        isForeground = false;
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

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                createNotificationChannels();
                final SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
                final String savedToken = prefs.getString("access_token", null);
                if (savedToken != null && !savedToken.trim().isEmpty() && activeUserId != null) {
                    try {
                        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                            if (task.isSuccessful() && task.getResult() != null) {
                                String token = task.getResult();
                                prefs.edit().putString("fcm_token", token).apply();
                                PartnerFirebaseMessagingService.syncTokenToSupabase(savedToken, activeUserId, activeRole, token);
                            }
                        });
                    } catch (Exception ignored) {}
                }
            }
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // Canonical sound URI using resource name
            Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/raw/order_siren");

            // Clean up old legacy channel if present
            try {
                NotificationChannel legacyOrdersChannel = notificationManager.getNotificationChannel("orders_channel");
                if (legacyOrdersChannel != null) {
                    notificationManager.deleteNotificationChannel("orders_channel");
                }
            } catch (Exception ignored) {}

            NotificationChannel existing = notificationManager.getNotificationChannel("orders_channel_v2");
            if (existing != null) {
                if (existing.getImportance() >= NotificationManager.IMPORTANCE_HIGH) {
                    return;
                }
                try {
                    notificationManager.deleteNotificationChannel("orders_channel_v2");
                } catch (Exception ignored) {}
            }

            // 1. Primary channel for high-priority order and delivery alerts
            CharSequence ordersName = "Orders & Partner Alerts";
            String ordersDesc = "Instant notifications and continuous sirens for new orders and delivery dispatches";
            int ordersImportance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel ordersChannel = new NotificationChannel("orders_channel_v2", ordersName, ordersImportance);
            ordersChannel.setDescription(ordersDesc);
            ordersChannel.enableVibration(true);
            ordersChannel.setVibrationPattern(new long[]{0, 800, 400, 800, 400});
            ordersChannel.enableLights(true);
            ordersChannel.setLightColor(Color.parseColor("#F45D2C"));
            ordersChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            // Set alarm audio attributes with bundled order_siren
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build();
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

            // 1. Maximize alarm audio volume (loud and clear 100%)
            try {
                AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                    am.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
                }
            } catch (Exception ignored) {}

            // 2. Looping MediaPlayer on STREAM_ALARM
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
                    Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                    if (alertUri == null) alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                    alarmMediaPlayer = new MediaPlayer();
                    alarmMediaPlayer.setDataSource(getApplicationContext(), alertUri);
                    alarmMediaPlayer.setLooping(true);
                    alarmMediaPlayer.prepare();
                    alarmMediaPlayer.start();
                }
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

                Intent silenceIntent = new Intent(this, AlarmDismissReceiver.class);
                silenceIntent.setAction(AlarmDismissReceiver.ACTION_DISMISS_ALARM);
                silenceIntent.putExtra(AlarmDismissReceiver.EXTRA_NOTIFICATION_ID, ALARM_NOTIFICATION_ID);
                PendingIntent silencePendingIntent = PendingIntent.getBroadcast(this, ALARM_NOTIFICATION_ID + 1, silenceIntent, pendingFlags);

                // Decode circular/brand logo for right-side Large Icon
                Bitmap largeIcon = null;
                try {
                    largeIcon = BitmapFactory.decodeResource(getResources(), R.drawable.ic_kgt_brand_logo);
                    if (largeIcon == null) {
                        largeIcon = PartnerFirebaseMessagingService.getDrawableBitmap(this, R.mipmap.ic_launcher_round);
                    }
                    if (largeIcon == null) {
                        largeIcon = PartnerFirebaseMessagingService.getDrawableBitmap(this, R.mipmap.ic_launcher);
                    }
                } catch (Exception ignored) {}

                String alertTitle = (title != null && !title.isEmpty()) ? title : "🚨 NEW ORDER RECEIVED!";
                String alertBody = (body != null && !body.isEmpty()) ? body : "Tap to open and accept order immediately.";

                NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "orders_channel_v2")
                        .setSmallIcon(R.drawable.ic_notification)
                        .setColor(Color.parseColor("#F45D2C"))
                        .setContentTitle(alertTitle)
                        .setContentText(alertBody)
                        .setStyle(new NotificationCompat.BigTextStyle().setBigContentTitle(alertTitle).bigText(alertBody))
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_ALARM)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setFullScreenIntent(pendingIntent, true)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)
                        .setDeleteIntent(silencePendingIntent);

                if (largeIcon != null) {
                    builder.setLargeIcon(largeIcon);
                }

                Notification notif = builder.build();
                // FLAG_INSISTENT repeats audio until notification is handled
                notif.flags |= Notification.FLAG_INSISTENT;

                nm.notify(ALARM_NOTIFICATION_ID, notif);
            }
        } catch (Exception ignored) {}
    }

    public synchronized void stopContinuousAlarm() {
        isAlarmActive = false;
        PartnerFirebaseMessagingService.stopAuxiliarySiren();
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

    public void onForegroundFcmAlert(final String orderId, final String role, final String title, final String body, final String notificationType) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if ("NEW_ORDER".equals(notificationType) || "DELIVERY_AVAILABLE".equals(notificationType)) {
                    startContinuousAlarm(orderId, role, title, body);
                }
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().evaluateJavascript(
                        "(function() { " +
                        "  try { " +
                        "    window.dispatchEvent(new CustomEvent('kgt:fcm_order_alert', { " +
                        "      detail: { orderId: '" + (orderId != null ? orderId : "") + "', role: '" + (role != null ? role : "") + "', type: '" + (notificationType != null ? notificationType : "") + "' } " +
                        "    })); " +
                        "    if (typeof window.__kgt_refresh_orders === 'function') window.__kgt_refresh_orders(); " +
                        "  } catch(e) {} " +
                        "})();",
                        null
                    );
                }
            }
        });
    }

    public synchronized void updateSession(final String accessToken, final String role, final String userId) {
        final SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
        if (accessToken == null || accessToken.trim().isEmpty()) {
            stopOrderPoller();
            final String savedFcmToken = prefs.getString("fcm_token", null);
            final String prevAuth = this.activeAccessToken;
            if (savedFcmToken != null && !savedFcmToken.trim().isEmpty()) {
                deactivateTokenInSupabase(savedFcmToken, prevAuth);
            }
            activeAccessToken = null;
            activeRole = null;
            activeUserId = null;
            prefs.edit().clear().apply();
            return;
        }

        String normalizedRole = (role != null && !role.isEmpty()) ? role.toLowerCase() : "restaurant";
        boolean sessionChanged = !accessToken.equals(this.activeAccessToken)
                || !normalizedRole.equals(this.activeRole)
                || (userId != null && !userId.equals(this.activeUserId));

        this.activeAccessToken = accessToken;
        this.activeRole = normalizedRole;
        this.activeUserId = userId;

        prefs.edit()
            .putString("access_token", accessToken)
            .putString("role", activeRole)
            .putString("user_id", userId)
            .apply();

        // Start native Order Poller
        startOrderPoller();

        // Retrieve FCM token and sync to Supabase (throttle to once per 60s unless session changed)
        long lastSyncTime = prefs.getLong("last_fcm_sync_time", 0);
        long now = System.currentTimeMillis();
        if (sessionChanged || (now - lastSyncTime > 60000)) {
            try {
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(new OnCompleteListener<String>() {
                    @Override
                    public void onComplete(@NonNull Task<String> task) {
                        if (task.isSuccessful() && task.getResult() != null) {
                            String token = task.getResult();
                            prefs.edit()
                                .putString("fcm_token", token)
                                .putLong("last_fcm_sync_time", System.currentTimeMillis())
                                .apply();
                            PartnerFirebaseMessagingService.syncTokenToSupabase(accessToken, userId, activeRole, token);
                        }
                    }
                });
            } catch (Exception ignored) {}
        }
    }

    private void deactivateTokenInSupabase(final String fcmToken, final String tokenAuth) {
        if (fcmToken == null || fcmToken.trim().isEmpty()) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("https://bvacebeorvxwcfkselon.supabase.co/rest/v1/push_devices?token=eq." + java.net.URLEncoder.encode(fcmToken, "UTF-8"));
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("DELETE");
                    conn.setRequestProperty("apikey", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
                    String auth = (tokenAuth != null && !tokenAuth.trim().isEmpty()) ? tokenAuth : activeAccessToken;
                    if (auth != null && !auth.trim().isEmpty()) {
                        conn.setRequestProperty("Authorization", "Bearer " + auth);
                    } else {
                        conn.setRequestProperty("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2YWNlYmVvcnZ4d2Nma3NlbG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTA2ODQsImV4cCI6MjA5NTM2NjY4NH0.3PUMlqniJqMnl_yNBc3Lu4JBOcMNK_RT0BLqb1nmohY");
                    }
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    int resCode = conn.getResponseCode();
                    Log.d(TAG, "deactivateTokenInSupabase (push_devices DELETE) response code: " + resCode);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to delete push_devices token on logout", e);
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        }).start();
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

        final String lowerRole = role.toLowerCase();
        if ("rider".equals(lowerRole)) {
            pollRiderOffers(token);
        } else if (lowerRole.contains("zone") || lowerRole.contains("manager")) {
            pollZoneOrders(token);
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
                                final String oId = orderId;
                                final String drop = obj.optString("drop_area", "Customer Delivery");
                                final double total = obj.optDouble("total", 0.0);
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        startContinuousAlarm(
                                            oId,
                                            "rider",
                                            "🛵 NEW DELIVERY OFFER!",
                                            "Drop: " + drop + " · ₹" + ((int) Math.round(total)) + " · Tap to Accept!"
                                        );
                                    }
                                });
                            }
                        }
                    }
                    if (activeOffers == 0 && isAlarmActive) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                stopContinuousAlarm();
                            }
                        });
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void pollZoneOrders(String token) {
        SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
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
                                final String oId = orderId;
                                final double total = obj.optDouble("total", 0.0);
                                final String shortId = oId.length() >= 8 ? oId.substring(0, 8).toUpperCase() : oId;
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        startContinuousAlarm(
                                            oId,
                                            "zone_manager",
                                            "📦 NEW ZONE ORDER!",
                                            "Order #" + shortId + " · ₹" + ((int) Math.round(total)) + " · Tap to dispatch!"
                                        );
                                    }
                                });
                            }
                        }
                    }
                    if (pendingCount == 0 && isAlarmActive) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                stopContinuousAlarm();
                            }
                        });
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
                        }
                    }
                    if (placedCount == 0 && isAlarmActive) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                stopContinuousAlarm();
                            }
                        });
                    }
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    public class AlertJavascriptInterface {
        @JavascriptInterface
        public void syncZoneId(final String zoneId) {
            if (zoneId != null && !zoneId.trim().isEmpty()) {
                getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE)
                    .edit().putString("zone_id", zoneId.trim()).apply();
            }
        }
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

        @JavascriptInterface
        public String getFcmToken() {
            SharedPreferences prefs = getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
            return prefs.getString("fcm_token", "");
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
        isForeground = false;
        if (instance == this) {
            instance = null;
        }
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
