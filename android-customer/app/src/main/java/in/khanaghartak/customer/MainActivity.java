package in.khanaghartak.customer;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.cashfree.pg.api.CFPaymentGatewayService;
import com.cashfree.pg.core.api.CFSession;
import com.cashfree.pg.core.api.CFTheme;
import com.cashfree.pg.core.api.callback.CFCheckoutResponseCallback;
import com.cashfree.pg.ui.api.CFDropCheckoutPayment;
import com.cashfree.pg.core.api.exception.CFException;
import com.cashfree.pg.core.api.utils.CFErrorResponse;
import com.cashfree.pg.core.api.upi.CFUPI;
import com.cashfree.pg.core.api.upi.CFUPIPayment;
import com.cashfree.pg.core.api.utils.CFUPIApp;
import com.cashfree.pg.core.api.utils.CFUPIUtil;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import com.google.android.gms.auth.api.phone.SmsRetriever;
import com.google.android.gms.auth.api.phone.SmsRetrieverClient;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Status;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.location.CurrentLocationRequest;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.LocationSettingsResponse;
import com.google.android.gms.location.SettingsClient;
import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.tasks.CancellationTokenSource;
import android.app.AlertDialog;
import android.app.Dialog;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.os.Message;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.graphics.drawable.GradientDrawable;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity implements CFCheckoutResponseCallback {
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    private static final int SMS_CONSENT_REQUEST = 1002;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1003;
    private static final int REQUEST_CHECK_SETTINGS = 1004;

    private BroadcastReceiver smsVerificationReceiver;
    private boolean isSmsConsentRegistered = false;

    private static final double SERVICE_CENTER_LAT = 25.1842;
    private static final double SERVICE_CENTER_LNG = 81.6212;
    private static final double SERVICE_RADIUS_KM = 12.0;

    private static final double CHAKGHAT_CENTER_LAT = 25.0275;
    private static final double CHAKGHAT_CENTER_LNG = 81.7375;
    private static final double CHAKGHAT_RADIUS_KM = 15.0;

    private static final double[][] SHANKARGARH_POLYGON = {
        {25.231022, 81.586002},
        {25.222831, 81.599661},
        {25.219243, 81.647637},
        {25.224099, 81.676012},
        {25.215332, 81.677157},
        {25.202136, 81.664307},
        {25.185085, 81.638961},
        {25.157103, 81.640885},
        {25.167217, 81.611500},
        {25.185978, 81.594873},
        {25.197182, 81.559681}
    };

    private static final double[][] CHAKGHAT_POLYGON = {
        {24.981876, 81.690224},
        {24.981205, 81.698695},
        {24.988809, 81.702797},
        {25.001377, 81.713872},
        {25.000292, 81.729683},
        {25.009535, 81.737373},
        {25.019709, 81.749361},
        {25.027381, 81.752970},
        {25.039671, 81.748045},
        {25.044969, 81.747826},
        {25.059190, 81.740312},
        {25.075695, 81.741864},
        {25.076044, 81.759938},
        {25.082158, 81.742176},
        {25.083460, 81.728367},
        {25.074721, 81.735442},
        {25.053820, 81.728049},
        {25.055585, 81.704847},
        {25.055181, 81.694430},
        {25.044400, 81.671121},
        {25.044501, 81.650983},
        {25.020127, 81.664495},
        {25.018384, 81.700384},
        {25.005071, 81.694029}
    };

    private boolean isOutsideServiceZone = false;
    private Location cachedDeviceLocation = null;
    private FusedLocationProviderClient fusedLocationClient = null;
    private SettingsClient settingsClient = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CashfreePaymentPlugin.class);
        super.onCreate(savedInstanceState);

        try {
            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
            settingsClient = LocationServices.getSettingsClient(this);
        } catch (Exception ignored) {}

        createNotificationChannel();

        // Ensure status bar is solid orange (#F45D2C) and does not overlap app content
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            android.view.Window window = getWindow();
            window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(android.graphics.Color.parseColor("#F45D2C"));
        }

        // Apply WindowInsetsListener so the root view adds top padding equal to status bar height
        android.view.View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, insets) -> {
                androidx.core.graphics.Insets statusBarInsets = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.statusBars());
                v.setPadding(0, statusBarInsets.top, 0, 0);
                return insets;
            });
        }

        // Request runtime permissions on launch (Notifications + Location)
        requestPermissionsOnLaunch();

        try {
            CFPaymentGatewayService.initialize(MainActivity.this);
            CFPaymentGatewayService.getInstance().setCheckoutCallback(this);
            android.util.Log.i("KhanaGharTak", "Cashfree SDK initialized successfully");
        } catch (CFException e) {
            android.util.Log.e("KhanaGharTak", "Failed to initialize Cashfree checkout callback", e);
        }

        if (this.bridge != null) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                try {
                    String ua = webView.getSettings().getUserAgentString();
                    if (!ua.contains("KhanaGharTakCustomerApp")) {
                        webView.getSettings().setUserAgentString(ua + " KhanaGharTakCustomerApp");
                    }
                    webView.getSettings().setGeolocationEnabled(true);
                } catch (Exception ignored) {}
                webView.addJavascriptInterface(new OtpJavascriptInterface(), "AndroidOtp");
                webView.addJavascriptInterface(new AppJavascriptInterface(), "AndroidApp");
                webView.addJavascriptInterface(new CashfreeJavascriptInterface(this), "AndroidCashfree");
                webView.addJavascriptInterface(new CashfreeJavascriptInterface(this), "_rawAndroidCashfree");
                webView.post(new Runnable() {
                    @Override
                    public void run() {
                        applyAppScripts(bridge.getWebView());
                    }
                });
            }
            this.bridge.addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    super.onPageLoaded(webView);
                    try {
                        String ua = webView.getSettings().getUserAgentString();
                        if (!ua.contains("KhanaGharTakCustomerApp")) {
                            webView.getSettings().setUserAgentString(ua + " KhanaGharTakCustomerApp");
                        }
                        webView.addJavascriptInterface(new OtpJavascriptInterface(), "AndroidOtp");
                        webView.addJavascriptInterface(new AppJavascriptInterface(), "AndroidApp");
                        webView.addJavascriptInterface(new CashfreeJavascriptInterface(MainActivity.this), "AndroidCashfree");
                        webView.addJavascriptInterface(new CashfreeJavascriptInterface(MainActivity.this), "_rawAndroidCashfree");
                    } catch (Exception ignored) {}
                    applyAppScripts(webView);
                }

                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    super.onPageCommitVisible(view, url);
                    applyAppScripts(view);
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            applyAppScripts(this.bridge.getWebView());
        }
        if (hasLaunchedUpiPayment) {
            hasLaunchedUpiPayment = false;
            if (lastPaymentOrderId != null && !lastPaymentOrderId.trim().isEmpty()) {
                final String oId = lastPaymentOrderId.trim();
                Toast.makeText(this, "Checking payment confirmation...", Toast.LENGTH_SHORT).show();
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    this.bridge.getWebView().postDelayed(() -> {
                        if (bridge != null && bridge.getWebView() != null) {
                            bridge.getWebView().evaluateJavascript(
                                "(function() {" +
                                "  if (window.location.pathname === '/checkout' || window.location.pathname.indexOf('/checkout') !== -1) {" +
                                "    if (typeof window.__kgt_check_order_status === 'function') {" +
                                "      window.__kgt_check_order_status('" + oId + "');" +
                                "    } else {" +
                                "      window.location.href = '/payment/cashfree/return?cf_order_id=" + oId + "';" +
                                "    }" +
                                "  }" +
                                "})();",
                                null
                            );
                        }
                    }, 1200);
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().evaluateJavascript(
                "(function() { " +
                "  if (typeof window.__kgt_customer_handle_back === 'function') { " +
                "    window.__kgt_customer_handle_back(); " +
                "  } else { " +
                "    var p = window.location.pathname || ''; " +
                "    if (p === '/home' || p === '/' || p === '' || p === '/login' || p.indexOf('/login') !== -1 || p === '/orders' || p === '/cart') { " +
                "      if (window.AndroidApp) window.AndroidApp.exitApp(); " +
                "    } else { " +
                "      window.location.replace('/home'); " +
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
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST_CODE);
            }
        }

        // Location permission
        boolean fineGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarseGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (fineGranted || coarseGranted) {
            evaluateLocation();
        } else {
            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                },
                LOCATION_PERMISSION_REQUEST_CODE
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            boolean granted = false;
            for (int res : grantResults) {
                if (res == PackageManager.PERMISSION_GRANTED) {
                    granted = true;
                    break;
                }
            }

            if (granted) {
                evaluateLocation();
            } else {
                // If location permission denied, DO NOT assume inside service zone!
                // The customer must select/enter a delivery address before service zone is active.
            }

            super.onRequestPermissionsResult(requestCode, permissions, grantResults);
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    private void evaluateLocation() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) return;

        checkLocationSettings();

        try {
            if (fusedLocationClient == null) {
                fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
            }
            fusedLocationClient.getLastLocation().addOnSuccessListener(this, location -> {
                if (location != null) {
                    cachedDeviceLocation = location;
                    processCoordinates(location.getLatitude(), location.getLongitude());
                }
                requestFreshLocation();
            }).addOnFailureListener(e -> {
                requestFreshLocation();
            });
        } catch (SecurityException ignored) {
        } catch (Exception ignored) {
            requestFreshLocation();
        }
    }

    private void requestFreshLocation() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) return;

        try {
            if (fusedLocationClient == null) {
                fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
            }

            CancellationTokenSource cts = new CancellationTokenSource();
            CurrentLocationRequest currentReq = new CurrentLocationRequest.Builder()
                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                .setDurationMillis(8000)
                .setMaxUpdateAgeMillis(10000)
                .build();

            fusedLocationClient.getCurrentLocation(currentReq, cts.getToken())
                .addOnSuccessListener(this, location -> {
                    if (location != null) {
                        cachedDeviceLocation = location;
                        processCoordinates(location.getLatitude(), location.getLongitude());
                    } else {
                        requestBalancedLocation();
                    }
                })
                .addOnFailureListener(e -> {
                    requestBalancedLocation();
                });
        } catch (SecurityException ignored) {
        } catch (Exception ignored) {
            requestBalancedLocation();
        }
    }

    private void requestBalancedLocation() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) return;

        try {
            if (fusedLocationClient == null) {
                fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
            }

            CancellationTokenSource cts = new CancellationTokenSource();
            CurrentLocationRequest currentReq = new CurrentLocationRequest.Builder()
                .setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY)
                .setDurationMillis(10000)
                .setMaxUpdateAgeMillis(30000)
                .build();

            fusedLocationClient.getCurrentLocation(currentReq, cts.getToken())
                .addOnSuccessListener(this, location -> {
                    if (location != null) {
                        cachedDeviceLocation = location;
                        processCoordinates(location.getLatitude(), location.getLongitude());
                    }
                });
        } catch (SecurityException ignored) {} catch (Exception ignored) {}
    }

    private void checkLocationSettings() {
        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000)
                .setMinUpdateIntervalMillis(5000)
                .build();

            LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder()
                .addLocationRequest(locationRequest);

            if (settingsClient == null) {
                settingsClient = LocationServices.getSettingsClient(this);
            }

            settingsClient.checkLocationSettings(builder.build())
                .addOnFailureListener(this, e -> {
                    if (e instanceof ResolvableApiException) {
                        try {
                            ResolvableApiException resolvable = (ResolvableApiException) e;
                            resolvable.startResolutionForResult(MainActivity.this, REQUEST_CHECK_SETTINGS);
                        } catch (Exception ignored) {}
                    }
                });
        } catch (Exception ignored) {}
    }

    private void sendFusedLocationSuccess(String callbackId, Location loc) {
        if (bridge == null || bridge.getWebView() == null || callbackId == null) return;
        String js = String.format(java.util.Locale.US,
            "if (typeof window.__kgt_on_native_location === 'function') { " +
            "  window.__kgt_on_native_location('%s', %f, %f, %f, null); " +
            "}",
            callbackId, loc.getLatitude(), loc.getLongitude(), (double) loc.getAccuracy()
        );
        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(js, null));
    }

    private void sendFusedLocationError(String callbackId, int code, String msg) {
        if (bridge == null || bridge.getWebView() == null || callbackId == null) return;
        String js = String.format(java.util.Locale.US,
            "if (typeof window.__kgt_on_native_location === 'function') { " +
            "  window.__kgt_on_native_location('%s', null, null, null, { code: %d, message: '%s' }); " +
            "}",
            callbackId, code, (msg != null ? msg.replace("'", "\\'") : "")
        );
        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(js, null));
    }

    private void requestBalancedForCallback(String callbackId) {
        try {
            if (fusedLocationClient == null) fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
            CancellationTokenSource cts = new CancellationTokenSource();
            CurrentLocationRequest req = new CurrentLocationRequest.Builder()
                .setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY)
                .setDurationMillis(8000)
                .build();
            fusedLocationClient.getCurrentLocation(req, cts.getToken())
                .addOnSuccessListener(this, location -> {
                    if (location != null) {
                        cachedDeviceLocation = location;
                        processCoordinates(location.getLatitude(), location.getLongitude());
                        sendFusedLocationSuccess(callbackId, location);
                    } else if (cachedDeviceLocation != null) {
                        sendFusedLocationSuccess(callbackId, cachedDeviceLocation);
                    } else {
                        sendFusedLocationError(callbackId, 2, "Unable to detect GPS. Please select your address on the map.");
                    }
                })
                .addOnFailureListener(e -> {
                    if (cachedDeviceLocation != null) {
                        sendFusedLocationSuccess(callbackId, cachedDeviceLocation);
                    } else {
                        sendFusedLocationError(callbackId, 2, e.getMessage() != null ? e.getMessage() : "Location request failed");
                    }
                });
        } catch (Exception e) {
            sendFusedLocationError(callbackId, 2, e.getMessage() != null ? e.getMessage() : "Location request failed");
        }
    }

    private void processCoordinates(double lat, double lng) {
        boolean inside = isWithinServiceZone(lat, lng);
        isOutsideServiceZone = !inside;

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().post(new Runnable() {
                @Override
                public void run() {
                    float acc = (cachedDeviceLocation != null) ? cachedDeviceLocation.getAccuracy() : 20.0f;
                    String coordScript = String.format(java.util.Locale.US,
                        "try { " +
                        "  window.__native_device_coords = {lat: %f, lng: %f, accuracy: %f, ts: Date.now()}; " +
                        "  localStorage.setItem('kgt:user-coords', JSON.stringify(window.__native_device_coords)); " +
                        "  if (%s) { " +
                        "    window.__native_device_outside = false; " +
                        "    localStorage.setItem('kgt:device-outside', 'false'); " +
                        "  } " +
                        "  window.dispatchEvent(new CustomEvent('kgt:native-coords', {detail: window.__native_device_coords})); " +
                        "  window.dispatchEvent(new Event('storage')); " +
                        "  window.dispatchEvent(new Event('kgt:address-changed')); " +
                        "} catch(e){}",
                        lat, lng, (double) acc, (inside ? "true" : "false")
                    );
                    bridge.getWebView().evaluateJavascript(coordScript, null);
                    applyAppScripts(bridge.getWebView());
                }
            });
        }
    }

    private static boolean isWithinServiceZone(double lat, double lng) {
        if (pointInPolygon(lat, lng, SHANKARGARH_POLYGON)) {
            return true;
        }
        if (pointInPolygon(lat, lng, CHAKGHAT_POLYGON)) {
            return true;
        }
        double distShankar = haversineKm(lat, lng, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG);
        if (distShankar <= SERVICE_RADIUS_KM) {
            return true;
        }
        double distChakghat = haversineKm(lat, lng, CHAKGHAT_CENTER_LAT, CHAKGHAT_CENTER_LNG);
        return distChakghat <= CHAKGHAT_RADIUS_KM;
    }

    private static boolean pointInPolygon(double lat, double lng, double[][] poly) {
        boolean inside = false;
        for (int i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            double xi = poly[i][1], yi = poly[i][0];
            double xj = poly[j][1], yj = poly[j][0];
            if (yj == yi) continue;
            if (yi > lat != yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private String customerScriptCache = null;

    private String getCustomerScript() {
        if (customerScriptCache != null) return customerScriptCache;
        try (java.io.InputStream is = getAssets().open("customer_injected.js");
             java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(is, java.nio.charset.StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            customerScriptCache = sb.toString();
            return customerScriptCache;
        } catch (Exception e) {
            android.util.Log.e("KhanaGharTak", "Failed to load customer_injected.js from assets", e);
            return "";
        }
    }

    private void applyAppScripts(WebView webView) {
        if (webView == null) return;
        String script = getCustomerScript();
        if (script != null && !script.isEmpty()) {
            webView.evaluateJavascript(script, null);
        }
    }

    private void createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            CharSequence name = "Orders & Delivery Updates";
            String description = "Notifications for order confirmations, preparation and delivery updates";
            int importance = android.app.NotificationManager.IMPORTANCE_HIGH;
            android.app.NotificationChannel channel = new android.app.NotificationChannel("fcm_default_channel", name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.enableLights(true);
            channel.setLightColor(android.graphics.Color.parseColor("#F45D2C"));

            android.app.NotificationManager notificationManager = getSystemService(android.app.NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    public class AppJavascriptInterface {
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

        @JavascriptInterface
        public String getDeviceCoordinates() {
            try {
                if (cachedDeviceLocation != null) {
                    JSONObject obj = new JSONObject();
                    obj.put("lat", cachedDeviceLocation.getLatitude());
                    obj.put("lng", cachedDeviceLocation.getLongitude());
                    obj.put("accuracy", (double) cachedDeviceLocation.getAccuracy());
                    obj.put("ts", cachedDeviceLocation.getTime());
                    return obj.toString();
                }
            } catch (Exception ignored) {}
            return null;
        }

        @JavascriptInterface
        public void refreshLocation() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    evaluateLocation();
                }
            });
        }

        @JavascriptInterface
        public void requestFusedLocation(final String callbackId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    boolean fine = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                    boolean coarse = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                    if (!fine && !coarse) {
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                            LOCATION_PERMISSION_REQUEST_CODE
                        );
                        sendFusedLocationError(callbackId, 1, "Location permission not granted");
                        return;
                    }

                    checkLocationSettings();

                    if (fusedLocationClient == null) {
                        fusedLocationClient = LocationServices.getFusedLocationProviderClient(MainActivity.this);
                    }

                    try {
                        fusedLocationClient.getLastLocation().addOnSuccessListener(MainActivity.this, lastLoc -> {
                            if (lastLoc != null && (System.currentTimeMillis() - lastLoc.getTime() < 30000)) {
                                cachedDeviceLocation = lastLoc;
                                processCoordinates(lastLoc.getLatitude(), lastLoc.getLongitude());
                                sendFusedLocationSuccess(callbackId, lastLoc);
                                return;
                            }

                            CancellationTokenSource cts = new CancellationTokenSource();
                            CurrentLocationRequest req = new CurrentLocationRequest.Builder()
                                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                                .setDurationMillis(8000)
                                .build();

                            fusedLocationClient.getCurrentLocation(req, cts.getToken())
                                .addOnSuccessListener(MainActivity.this, location -> {
                                    if (location != null) {
                                        cachedDeviceLocation = location;
                                        processCoordinates(location.getLatitude(), location.getLongitude());
                                        sendFusedLocationSuccess(callbackId, location);
                                    } else {
                                        requestBalancedForCallback(callbackId);
                                    }
                                })
                                .addOnFailureListener(e -> {
                                    requestBalancedForCallback(callbackId);
                                });
                        }).addOnFailureListener(e -> {
                            requestBalancedForCallback(callbackId);
                        });
                    } catch (SecurityException se) {
                        sendFusedLocationError(callbackId, 1, "Location permission denied");
                    } catch (Exception ex) {
                        requestBalancedForCallback(callbackId);
                    }
                }
            });
        }
    }

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
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
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
        Matcher m1 = Pattern.compile("(?i)(?:otp|code|pin|verification|login)[^0-9]*?([0-9]{4,6})").matcher(message);
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
        String js = String.format(java.util.Locale.US,
            "(function() {" +
            "  var otp = '%s';" +
            "  if (typeof window.__kgt_set_otp === 'function') {" +
            "    try { window.__kgt_set_otp(otp); return true; } catch(e){}" +
            "  }" +
            "  function fill() {" +
            "    var inputs = document.querySelectorAll('input');" +
            "    var targetInput = null;" +
            "    for (var i = 0; i < inputs.length; i++) {" +
            "      var inp = inputs[i];" +
            "      var placeholder = inp.getAttribute('placeholder') || '';" +
            "      var maxLen = inp.getAttribute('maxlength') || '';" +
            "      var cls = inp.className || '';" +
            "      if (placeholder.indexOf('____') !== -1 || maxLen === '4' || cls.indexOf('ck-input') !== -1) {" +
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

    private Dialog nativePaymentDialog = null;
    private volatile boolean hasLaunchedUpiPayment = false;
    private String lastLaunchedUpiApp = null;
    private volatile String lastPaymentOrderId = null;
    private volatile String currentPaymentSessionId = null;
    private volatile String currentPaymentMode = "PRODUCTION";

    public static class UpiAppItem {
        public final String packageName;
        public final String displayName;
        public final Drawable icon;
        public final int priority;

        public UpiAppItem(String packageName, String displayName, Drawable icon, int priority) {
            this.packageName = packageName;
            this.displayName = displayName;
            this.icon = icon;
            this.priority = priority;
        }
    }

    private int dpToPx(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density + 0.5f);
    }

    private List<UpiAppItem> getInstalledUpiAppsList() {
        List<UpiAppItem> list = new ArrayList<>();
        PackageManager pm = getPackageManager();
        Set<String> addedPackages = new HashSet<>();

        // Priority known UPI apps (PhonePe, Google Pay, Paytm, BHIM, CRED, WhatsApp)
        String[][] priorityApps = {
            {"com.phonepe.app", "PhonePe", "1"},
            {"com.google.android.apps.nbu.paisa.user", "Google Pay", "2"},
            {"net.one97.paytm", "Paytm", "3"},
            {"in.org.npci.upiapp", "BHIM", "4"},
            {"com.dreamplug.androidapp", "CRED", "5"},
            {"com.whatsapp", "WhatsApp", "6"}
        };

        for (String[] app : priorityApps) {
            String pkg = app[0];
            String defaultName = app[1];
            int prio = Integer.parseInt(app[2]);
            try {
                pm.getPackageInfo(pkg, 0);
                CharSequence label = null;
                Drawable icon = null;
                try {
                    label = pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0));
                    icon = pm.getApplicationIcon(pkg);
                } catch (Exception ignored) {}
                String name = (label != null && label.length() > 0) ? label.toString() : defaultName;
                if (icon == null) icon = ContextCompat.getDrawable(this, android.R.drawable.sym_def_app_icon);
                list.add(new UpiAppItem(pkg, name, icon, prio));
                addedPackages.add(pkg);
            } catch (PackageManager.NameNotFoundException ignored) {}
        }

        // Query any other apps registered for upi://pay intent
        try {
            Intent upiIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("upi://pay"));
            List<ResolveInfo> activities = pm.queryIntentActivities(upiIntent, PackageManager.MATCH_DEFAULT_ONLY);
            if (activities != null) {
                for (ResolveInfo ri : activities) {
                    if (ri.activityInfo != null && ri.activityInfo.packageName != null) {
                        String pkg = ri.activityInfo.packageName;
                        if (!addedPackages.contains(pkg)) {
                            CharSequence label = ri.loadLabel(pm);
                            Drawable icon = ri.loadIcon(pm);
                            String name = (label != null && label.length() > 0) ? label.toString() : pkg;
                            if (icon == null) icon = ContextCompat.getDrawable(this, android.R.drawable.sym_def_app_icon);
                            list.add(new UpiAppItem(pkg, name, icon, 10));
                            addedPackages.add(pkg);
                        }
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.w("KhanaGharTak", "Failed to query UPI intent activities", e);
        }

        Collections.sort(list, Comparator.comparingInt(a -> a.priority));
        return list;
    }

    private String resolveOrderIdFromCashfree(String paymentSessionId, String mode) {
        if (paymentSessionId == null || paymentSessionId.trim().isEmpty()) return null;
        HttpURLConnection conn = null;
        try {
            String baseUrl = ("SANDBOX".equalsIgnoreCase(mode) || "TEST".equalsIgnoreCase(mode))
                    ? "https://sandbox.cashfree.com/pg/orders/sessions"
                    : "https://api.cashfree.com/pg/orders/sessions";
            URL url = new URL(baseUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("x-api-version", "2023-08-01");
            conn.setRequestProperty("Origin", "https://khanaghartak.in");
            conn.setRequestProperty("Referer", "https://khanaghartak.in/");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setDoOutput(true);

            JSONObject body = new JSONObject();
            body.put("payment_session_id", paymentSessionId.trim());
            JSONObject upi = new JSONObject();
            upi.put("channel", "intent");
            JSONObject paymentMethod = new JSONObject();
            paymentMethod.put("upi", upi);
            body.put("payment_method", paymentMethod);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                os.flush();
            }

            int code = conn.getResponseCode();
            InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
            StringBuilder sb = new StringBuilder();
            if (is != null) {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = r.readLine()) != null) sb.append(line);
                }
            }
            String res = sb.toString();
            android.util.Log.d("KhanaGharTak", "resolveOrderId response [" + code + "]: " + res);
            if (code >= 200 && code < 400) {
                JSONObject json = new JSONObject(res);
                String oId = json.optString("order_id", json.optString("cf_order_id", ""));
                if (!oId.isEmpty()) return oId;
                if (json.has("data")) {
                    JSONObject data = json.getJSONObject("data");
                    String doId = data.optString("order_id", data.optString("cf_order_id", ""));
                    if (!doId.isEmpty()) return doId;
                    String dataUrl = data.optString("url", "");
                    if (dataUrl.contains("tr=")) {
                        Matcher m = Pattern.compile("[?&]tr=([^&]+)").matcher(dataUrl);
                        if (m.find()) return m.group(1);
                    }
                    Object payloadObj = data.opt("payload");
                    if (payloadObj instanceof JSONObject) {
                        JSONObject payload = (JSONObject) payloadObj;
                        String def = payload.optString("default", "");
                        if (def.contains("tr=")) {
                            Matcher m = Pattern.compile("[?&]tr=([^&]+)").matcher(def);
                            if (m.find()) return m.group(1);
                        }
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.w("KhanaGharTak", "Failed to resolve orderId from Cashfree", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    public void showNativePaymentOptionsDialog(final String paymentSessionId, final String orderId, final String mode) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (nativePaymentDialog != null && nativePaymentDialog.isShowing()) {
                        nativePaymentDialog.dismiss();
                    }

                    nativePaymentDialog = new Dialog(MainActivity.this, android.R.style.Theme_Translucent_NoTitleBar);

                    Window window = nativePaymentDialog.getWindow();
                    if (window != null) {
                        window.setWindowAnimations(android.R.style.Animation_InputMethod);
                    }

                    // Fullscreen overlay container with semi-transparent dim scrim
                    FrameLayout rootOverlay = new FrameLayout(MainActivity.this);
                    rootOverlay.setLayoutParams(new ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                    rootOverlay.setBackgroundColor(Color.parseColor("#80000000")); // 50% dark backdrop

                    // Clicking the dimmed backdrop outside the card dismisses the dialog
                    rootOverlay.setOnClickListener(v -> {
                        if (nativePaymentDialog != null) nativePaymentDialog.dismiss();
                        resetCheckoutCta("Payment was cancelled");
                    });

                    // Bottom card container
                    LinearLayout bottomCard = new LinearLayout(MainActivity.this);
                    bottomCard.setOrientation(LinearLayout.VERTICAL);
                    FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                    cardParams.gravity = Gravity.BOTTOM;
                    bottomCard.setLayoutParams(cardParams);
                    bottomCard.setPadding(dpToPx(20), dpToPx(14), dpToPx(20), dpToPx(28));

                    GradientDrawable cardBg = new GradientDrawable();
                    cardBg.setShape(GradientDrawable.RECTANGLE);
                    cardBg.setColor(Color.WHITE);
                    cardBg.setCornerRadii(new float[]{dpToPx(24), dpToPx(24), dpToPx(24), dpToPx(24), 0, 0, 0, 0});
                    bottomCard.setBackground(cardBg);

                    // Prevent click events inside the card from bubbling to rootOverlay (which would dismiss it)
                    bottomCard.setOnClickListener(v -> {});

                    // Top center drag handle
                    View dragHandle = new View(MainActivity.this);
                    LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dpToPx(44), dpToPx(5));
                    handleParams.gravity = Gravity.CENTER_HORIZONTAL;
                    handleParams.setMargins(0, 0, 0, dpToPx(16));
                    dragHandle.setLayoutParams(handleParams);
                    GradientDrawable handleBg = new GradientDrawable();
                    handleBg.setShape(GradientDrawable.RECTANGLE);
                    handleBg.setCornerRadius(dpToPx(3));
                    handleBg.setColor(Color.parseColor("#CBD5E1"));
                    dragHandle.setBackground(handleBg);
                    bottomCard.addView(dragHandle);

                    // Dynamic content container that switches between Step 1 (Categories) and Step 2 (UPI Apps)
                    final FrameLayout dynamicContainer = new FrameLayout(MainActivity.this);
                    dynamicContainer.setLayoutParams(new LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                    bottomCard.addView(dynamicContainer);

                    // Start on Step 1: Main payment methods (UPI, Cards, NetBanking)
                    renderStep1PaymentMethods(dynamicContainer, paymentSessionId, orderId, mode);

                    rootOverlay.addView(bottomCard);

                    nativePaymentDialog.setContentView(rootOverlay);
                    nativePaymentDialog.setCanceledOnTouchOutside(true);
                    nativePaymentDialog.setOnCancelListener(d -> {
                        resetCheckoutCta("Payment was cancelled");
                    });
                    nativePaymentDialog.setOnKeyListener((dialog, keyCode, event) -> {
                        if (keyCode == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
                            if (nativePaymentDialog != null) nativePaymentDialog.dismiss();
                            resetCheckoutCta("Payment was cancelled");
                            return true;
                        }
                        return false;
                    });
                    nativePaymentDialog.show();
                } catch (Exception e) {
                    android.util.Log.e("KhanaGharTak", "Failed to show payment dialog", e);
                    resetCheckoutCta("Could not open payment options");
                    Toast.makeText(MainActivity.this, "Could not open payment options. Please try again.", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private void renderStep1PaymentMethods(final FrameLayout container, final String paymentSessionId, final String orderId, final String mode) {
        container.removeAllViews();

        LinearLayout step1 = new LinearLayout(this);
        step1.setOrientation(LinearLayout.VERTICAL);
        step1.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Header (Title + Close)
        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);
        headerRow.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        headerRow.setPadding(0, 0, 0, dpToPx(14));

        LinearLayout titleLayout = new LinearLayout(this);
        titleLayout.setOrientation(LinearLayout.VERTICAL);
        titleLayout.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f));

        TextView title = new TextView(this);
        title.setText("Select Payment Method");
        title.setTextSize(17);
        title.setTypeface(null, Typeface.BOLD);
        title.setTextColor(Color.parseColor("#0F172A"));
        titleLayout.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Choose your preferred way to pay");
        sub.setTextSize(12);
        sub.setTextColor(Color.parseColor("#64748B"));
        titleLayout.addView(sub);

        headerRow.addView(titleLayout);

        TextView closeBtn = new TextView(this);
        closeBtn.setText("✕");
        closeBtn.setTextSize(20);
        closeBtn.setTextColor(Color.parseColor("#94A3B8"));
        closeBtn.setPadding(dpToPx(8), dpToPx(4), dpToPx(4), dpToPx(4));
        closeBtn.setOnClickListener(v -> {
            if (nativePaymentDialog != null) nativePaymentDialog.dismiss();
            resetCheckoutCta("Payment was cancelled");
        });
        headerRow.addView(closeBtn);
        step1.addView(headerRow);

        // Option 1: UPI (PhonePe, Google Pay, Paytm)
        // Clicking this transitions to Step 2 where installed UPI apps are displayed!
        View upiCard = createPaymentOptionCard(
            "UPI",
            "PhonePe, Google Pay, Paytm & other UPI apps",
            "⚡ Recommended",
            Color.parseColor("#059669"),
            Color.parseColor("#ECFDF5"),
            v -> renderStep2UpiApps(container, paymentSessionId, orderId, mode)
        );
        step1.addView(upiCard);

        // Option 2: Cards
        View cardCard = createPaymentOptionCard(
            "Debit / Credit Card",
            "Visa, Mastercard, RuPay, Maestro",
            null,
            Color.parseColor("#2563EB"),
            Color.parseColor("#EFF6FF"),
            v -> launchCashfreeCardsOrNetBanking(paymentSessionId, orderId, mode)
        );
        step1.addView(cardCard);

        // Option 3: Net Banking
        View nbCard = createPaymentOptionCard(
            "Net Banking",
            "All major Indian banks supported",
            null,
            Color.parseColor("#7C3AED"),
            Color.parseColor("#F5F3FF"),
            v -> launchCashfreeCardsOrNetBanking(paymentSessionId, orderId, mode)
        );
        step1.addView(nbCard);

        // Trust Footer
        TextView footer = new TextView(this);
        footer.setText("🔒 100% Safe & Secure Payments via Cashfree");
        footer.setTextSize(11);
        footer.setTextColor(Color.parseColor("#94A3B8"));
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(0, dpToPx(14), 0, dpToPx(4));
        step1.addView(footer);

        container.addView(step1);
    }

    private void renderStep2UpiApps(final FrameLayout container, final String paymentSessionId, final String orderId, final String mode) {
        container.removeAllViews();

        LinearLayout step2 = new LinearLayout(this);
        step2.setOrientation(LinearLayout.VERTICAL);
        step2.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Back button row
        LinearLayout backRow = new LinearLayout(this);
        backRow.setOrientation(LinearLayout.HORIZONTAL);
        backRow.setGravity(Gravity.CENTER_VERTICAL);
        backRow.setPadding(0, 0, 0, dpToPx(12));
        backRow.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView backBtn = new TextView(this);
        backBtn.setText("← Other Payment Options");
        backBtn.setTextSize(13);
        backBtn.setTypeface(null, Typeface.BOLD);
        backBtn.setTextColor(Color.parseColor("#F45D2C"));
        backBtn.setPadding(0, dpToPx(4), dpToPx(12), dpToPx(4));
        backBtn.setClickable(true);
        backBtn.setOnClickListener(v -> renderStep1PaymentMethods(container, paymentSessionId, orderId, mode));
        backRow.addView(backBtn);

        View spacer = new View(this);
        spacer.setLayoutParams(new LinearLayout.LayoutParams(0, 1, 1.0f));
        backRow.addView(spacer);

        TextView closeBtn = new TextView(this);
        closeBtn.setText("✕");
        closeBtn.setTextSize(20);
        closeBtn.setTextColor(Color.parseColor("#94A3B8"));
        closeBtn.setPadding(dpToPx(8), dpToPx(4), dpToPx(4), dpToPx(4));
        closeBtn.setOnClickListener(v -> {
            if (nativePaymentDialog != null) nativePaymentDialog.dismiss();
            resetCheckoutCta("Payment was cancelled");
        });
        backRow.addView(closeBtn);
        step2.addView(backRow);

        // Header Title
        TextView upiTitle = new TextView(this);
        upiTitle.setText("Pay via UPI");
        upiTitle.setTextSize(17);
        upiTitle.setTypeface(null, Typeface.BOLD);
        upiTitle.setTextColor(Color.parseColor("#0F172A"));
        step2.addView(upiTitle);

        TextView upiSub = new TextView(this);
        upiSub.setText("Select your installed payment app");
        upiSub.setTextSize(12);
        upiSub.setTextColor(Color.parseColor("#64748B"));
        upiSub.setPadding(0, dpToPx(2), 0, dpToPx(12));
        step2.addView(upiSub);

        // Detect installed apps
        List<UpiAppItem> installedApps = getInstalledUpiAppsList();

        ScrollView scrollView = new ScrollView(this);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        scrollView.setLayoutParams(scrollParams);

        LinearLayout appList = new LinearLayout(this);
        appList.setOrientation(LinearLayout.VERTICAL);
        appList.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        if (!installedApps.isEmpty()) {
            for (final UpiAppItem app : installedApps) {
                View appRow = createNativeUpiAppCard(app, v -> {
                    launchNativeCashfreeUpi(paymentSessionId, orderId, mode, app.packageName, app.displayName);
                });
                appList.addView(appRow);
            }
        } else {
            TextView noApps = new TextView(this);
            noApps.setText("No supported UPI apps found on this phone.\nPlease use Debit/Credit Card or Net Banking.");
            noApps.setTextSize(13);
            noApps.setTextColor(Color.parseColor("#EF4444"));
            noApps.setPadding(dpToPx(8), dpToPx(12), dpToPx(8), dpToPx(12));
            appList.addView(noApps);
        }

        // Generic / Other UPI Chooser
        View otherRow = createPaymentOptionCard(
            "Other UPI Apps",
            "Choose any other UPI app on your phone",
            null,
            Color.parseColor("#059669"),
            Color.parseColor("#F0FDF4"),
            v -> launchNativeCashfreeUpi(paymentSessionId, orderId, mode, null, "UPI App")
        );
        appList.addView(otherRow);

        scrollView.addView(appList);
        step2.addView(scrollView);

        container.addView(step2);
    }

    private View createPaymentOptionCard(final String title, final String subtitle, final String tag,
                                         final int iconColor, final int iconBgColor, final View.OnClickListener onClick) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dpToPx(14), dpToPx(12), dpToPx(14), dpToPx(12));

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dpToPx(10));
        row.setLayoutParams(params);

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(dpToPx(12));
        bg.setColor(Color.WHITE);
        bg.setStroke(dpToPx(1), Color.parseColor("#E2E8F0"));
        row.setBackground(bg);
        row.setClickable(true);
        row.setFocusable(true);

        // Icon indicator
        TextView iconView = new TextView(this);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dpToPx(42), dpToPx(42));
        iconParams.setMargins(0, 0, dpToPx(14), 0);
        iconView.setLayoutParams(iconParams);
        iconView.setGravity(Gravity.CENTER);
        if ("UPI".equalsIgnoreCase(title)) {
            iconView.setText("UPI");
            iconView.setTextSize(12);
        } else if (title != null && title.contains("Card")) {
            iconView.setText("💳");
            iconView.setTextSize(18);
        } else if (title != null && title.contains("Net")) {
            iconView.setText("🏦");
            iconView.setTextSize(18);
        } else if (title != null && title.contains("Other")) {
            iconView.setText("⚡");
            iconView.setTextSize(18);
        } else {
            iconView.setText("₹");
            iconView.setTextSize(16);
        }
        iconView.setTypeface(null, Typeface.BOLD);
        iconView.setTextColor(iconColor);

        GradientDrawable iconBg = new GradientDrawable();
        iconBg.setShape(GradientDrawable.RECTANGLE);
        iconBg.setCornerRadius(dpToPx(12));
        iconBg.setColor(iconBgColor);
        iconView.setBackground(iconBg);
        row.addView(iconView);

        // Texts
        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f));

        LinearLayout titleLine = new LinearLayout(this);
        titleLine.setOrientation(LinearLayout.HORIZONTAL);
        titleLine.setGravity(Gravity.CENTER_VERTICAL);

        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextSize(15);
        titleView.setTypeface(null, Typeface.BOLD);
        titleView.setTextColor(Color.parseColor("#0F172A"));
        titleLine.addView(titleView);

        if (tag != null) {
            TextView tagView = new TextView(this);
            tagView.setText(tag);
            tagView.setTextSize(10);
            tagView.setTypeface(null, Typeface.BOLD);
            tagView.setTextColor(Color.parseColor("#059669"));
            tagView.setPadding(dpToPx(6), dpToPx(2), dpToPx(6), dpToPx(2));
            LinearLayout.LayoutParams tagParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            tagParams.setMargins(dpToPx(8), 0, 0, 0);
            tagView.setLayoutParams(tagParams);

            GradientDrawable tagBg = new GradientDrawable();
            tagBg.setShape(GradientDrawable.RECTANGLE);
            tagBg.setCornerRadius(dpToPx(4));
            tagBg.setColor(Color.parseColor("#ECFDF5"));
            tagView.setBackground(tagBg);
            titleLine.addView(tagView);
        }
        textCol.addView(titleLine);

        TextView subView = new TextView(this);
        subView.setText(subtitle);
        subView.setTextSize(12);
        subView.setTextColor(Color.parseColor("#64748B"));
        textCol.addView(subView);
        row.addView(textCol);

        // Arrow
        TextView arrow = new TextView(this);
        arrow.setText("›");
        arrow.setTextSize(20);
        arrow.setTextColor(Color.parseColor("#94A3B8"));
        arrow.setPadding(dpToPx(8), 0, dpToPx(4), 0);
        row.addView(arrow);

        row.setOnClickListener(onClick);
        return row;
    }

    private View createNativeUpiAppCard(final UpiAppItem app, final View.OnClickListener onClick) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dpToPx(14), dpToPx(10), dpToPx(14), dpToPx(10));

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dpToPx(8));
        row.setLayoutParams(params);

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setCornerRadius(dpToPx(12));
        bg.setColor(Color.WHITE);
        bg.setStroke(dpToPx(1), Color.parseColor("#E2E8F0"));
        row.setBackground(bg);
        row.setClickable(true);
        row.setFocusable(true);

        // App Icon (Real OS Drawable in 44x44 dp)
        ImageView iconView = new ImageView(this);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dpToPx(44), dpToPx(44));
        iconParams.setMargins(0, 0, dpToPx(14), 0);
        iconView.setLayoutParams(iconParams);
        iconView.setImageDrawable(app.icon);
        iconView.setScaleType(ImageView.ScaleType.FIT_CENTER);
        row.addView(iconView);

        // Texts
        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f));

        TextView titleView = new TextView(this);
        titleView.setText(app.displayName);
        titleView.setTextSize(15);
        titleView.setTypeface(null, Typeface.BOLD);
        titleView.setTextColor(Color.parseColor("#0F172A"));
        textCol.addView(titleView);

        TextView subView = new TextView(this);
        subView.setText("Instant 1-Click Pay");
        subView.setTextSize(12);
        subView.setTextColor(Color.parseColor("#16A34A"));
        textCol.addView(subView);
        row.addView(textCol);

        // "PAY ›" Action Pill
        TextView payPill = new TextView(this);
        payPill.setText("PAY  ›");
        payPill.setTextSize(11);
        payPill.setTypeface(null, Typeface.BOLD);
        payPill.setTextColor(Color.parseColor("#F45D2C"));
        payPill.setPadding(dpToPx(14), dpToPx(6), dpToPx(14), dpToPx(6));

        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setShape(GradientDrawable.RECTANGLE);
        pillBg.setCornerRadius(dpToPx(14));
        pillBg.setColor(Color.parseColor("#FFF7ED"));
        pillBg.setStroke(dpToPx(1), Color.parseColor("#FDBA74"));
        payPill.setBackground(pillBg);
        row.addView(payPill);

        row.setOnClickListener(onClick);
        return row;
    }

    private void launchNativeCashfreeUpi(final String paymentSessionId, final String orderId, final String mode,
                                         final String targetPackage, final String appName) {
        if (nativePaymentDialog != null && nativePaymentDialog.isShowing()) {
            nativePaymentDialog.dismiss();
        }

        Toast.makeText(MainActivity.this, "Connecting to " + appName + "...", Toast.LENGTH_SHORT).show();

        new Thread(new Runnable() {
            @Override
            public void run() {
                String resolvedOrderId = orderId;
                if (resolvedOrderId == null || resolvedOrderId.trim().isEmpty()) {
                    resolvedOrderId = resolveOrderIdFromCashfree(paymentSessionId, mode);
                }
                if (resolvedOrderId == null || resolvedOrderId.trim().isEmpty()) {
                    if (lastPaymentOrderId != null && !lastPaymentOrderId.trim().isEmpty()) {
                        resolvedOrderId = lastPaymentOrderId;
                    } else {
                        resolvedOrderId = "KGT_" + System.currentTimeMillis();
                    }
                }

                final String finalOrderId = resolvedOrderId.trim();
                lastPaymentOrderId = finalOrderId;
                hasLaunchedUpiPayment = true;
                lastLaunchedUpiApp = appName;

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            CFSession.Environment env = ("SANDBOX".equalsIgnoreCase(mode) || "TEST".equalsIgnoreCase(mode))
                                    ? CFSession.Environment.SANDBOX
                                    : CFSession.Environment.PRODUCTION;

                            CFSession cfSession = new CFSession.CFSessionBuilder()
                                    .setEnvironment(env)
                                    .setPaymentSessionID(paymentSessionId.trim())
                                    .setOrderId(finalOrderId)
                                    .build();

                            if (targetPackage != null && !targetPackage.trim().isEmpty()) {
                                CFUPI cfUpi = new CFUPI.CFUPIBuilder()
                                        .setMode(CFUPI.Mode.INTENT)
                                        .setUPIID(targetPackage.trim())
                                        .build();

                                CFUPIPayment cfUpiPayment = new CFUPIPayment.CFUPIPaymentBuilder()
                                        .setSession(cfSession)
                                        .setCfUPI(cfUpi)
                                        .build();

                                android.util.Log.i("KhanaGharTak", "Executing Cashfree Native UPI Intent: app=" + appName + ", pkg=" + targetPackage + ", order=" + finalOrderId);
                                CFPaymentGatewayService.getInstance().doPayment(MainActivity.this, cfUpiPayment);
                            } else {
                                // "Other UPI Apps": query Cashfree intent URI and open Android system chooser
                                launchDirectUpiFallback(paymentSessionId, finalOrderId, mode, null, appName);
                            }
                        } catch (Exception e) {
                            android.util.Log.w("KhanaGharTak", "Cashfree SDK doPayment threw exception, executing direct intent fallback", e);
                            launchDirectUpiFallback(paymentSessionId, finalOrderId, mode, targetPackage, appName);
                        }
                    }
                });
            }
        }).start();
    }

    private void launchDirectUpiFallback(final String paymentSessionId, final String orderId, final String mode,
                                         final String targetPackage, final String appName) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                String baseUrl = ("SANDBOX".equalsIgnoreCase(mode) || "TEST".equalsIgnoreCase(mode))
                        ? "https://sandbox.cashfree.com/pg/orders/sessions"
                        : "https://api.cashfree.com/pg/orders/sessions";
                String upiUrl = queryDirectCashfreeUpiUrl(baseUrl, paymentSessionId);

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (upiUrl != null && !upiUrl.trim().isEmpty()) {
                            try {
                                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(upiUrl.trim()));
                                if (targetPackage != null && !targetPackage.isEmpty()) {
                                    intent.setPackage(targetPackage);
                                }
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                hasLaunchedUpiPayment = true;
                                lastLaunchedUpiApp = appName;
                                Toast.makeText(MainActivity.this, "Opening " + appName + "...", Toast.LENGTH_SHORT).show();
                                return;
                            } catch (ActivityNotFoundException e) {
                                // Fallback without package filter to open system chooser
                                try {
                                    Intent generic = new Intent(Intent.ACTION_VIEW, Uri.parse(upiUrl.trim()));
                                    generic.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(Intent.createChooser(generic, "Pay via UPI App"));
                                    hasLaunchedUpiPayment = true;
                                    lastLaunchedUpiApp = "UPI App";
                                    return;
                                } catch (Exception ignored) {}
                            } catch (Exception e) {
                                android.util.Log.e("KhanaGharTak", "Failed to launch intent directly", e);
                            }
                        }
                        Toast.makeText(MainActivity.this, "Could not open " + appName + ". Please try Card or Net Banking.", Toast.LENGTH_SHORT).show();
                        resetCheckoutCta("Could not open payment app");
                    }
                });
            }
        }).start();
    }

    private String queryDirectCashfreeUpiUrl(String baseUrl, String paymentSessionId) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(baseUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("x-api-version", "2023-08-01");
            conn.setRequestProperty("Origin", "https://khanaghartak.in");
            conn.setRequestProperty("Referer", "https://khanaghartak.in/");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setDoOutput(true);

            JSONObject body = new JSONObject();
            body.put("payment_session_id", paymentSessionId);
            JSONObject upi = new JSONObject();
            upi.put("channel", "intent");
            JSONObject paymentMethod = new JSONObject();
            paymentMethod.put("upi", upi);
            body.put("payment_method", paymentMethod);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            InputStream is = (responseCode >= 200 && responseCode < 400) ? conn.getInputStream() : conn.getErrorStream();
            StringBuilder sb = new StringBuilder();
            if (is != null) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                }
            }
            String res = sb.toString();
            if (responseCode >= 200 && responseCode < 400) {
                JSONObject json = new JSONObject(res);
                if (json.has("data")) {
                    JSONObject data = json.getJSONObject("data");
                    String u = data.optString("url", "");
                    if (u.startsWith("upi://") || u.startsWith("intent://") || u.startsWith("phonepe://") || u.startsWith("tez://") || u.startsWith("paytmmp://")) {
                        return u;
                    }
                    Object payloadObj = data.opt("payload");
                    if (payloadObj instanceof JSONObject) {
                        JSONObject payload = (JSONObject) payloadObj;
                        String def = payload.optString("default", "");
                        if (!def.isEmpty()) return def;
                    }
                }
            }
        } catch (Exception e) {
            android.util.Log.w("KhanaGharTak", "queryDirectCashfreeUpiUrl error", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private void launchCashfreeCardsOrNetBanking(final String paymentSessionId, final String orderId, final String mode) {
        if (nativePaymentDialog != null && nativePaymentDialog.isShowing()) {
            nativePaymentDialog.dismiss();
        }

        Toast.makeText(MainActivity.this, "Opening secure checkout...", Toast.LENGTH_SHORT).show();

        new Thread(new Runnable() {
            @Override
            public void run() {
                String resolvedOrderId = orderId;
                if (resolvedOrderId == null || resolvedOrderId.trim().isEmpty()) {
                    resolvedOrderId = resolveOrderIdFromCashfree(paymentSessionId, mode);
                }
                if (resolvedOrderId == null || resolvedOrderId.trim().isEmpty()) {
                    if (lastPaymentOrderId != null && !lastPaymentOrderId.trim().isEmpty()) {
                        resolvedOrderId = lastPaymentOrderId;
                    } else {
                        resolvedOrderId = "KGT_" + System.currentTimeMillis();
                    }
                }

                final String finalOrderId = resolvedOrderId.trim();
                lastPaymentOrderId = finalOrderId;

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            CFSession.Environment env = ("SANDBOX".equalsIgnoreCase(mode) || "TEST".equalsIgnoreCase(mode))
                                    ? CFSession.Environment.SANDBOX
                                    : CFSession.Environment.PRODUCTION;

                            CFSession cfSession = new CFSession.CFSessionBuilder()
                                    .setEnvironment(env)
                                    .setPaymentSessionID(paymentSessionId.trim())
                                    .setOrderId(finalOrderId)
                                    .build();

                            CFTheme cfTheme = new CFTheme.CFThemeBuilder()
                                    .setNavigationBarBackgroundColor("#F45D2C")
                                    .setNavigationBarTextColor("#FFFFFF")
                                    .setButtonBackgroundColor("#F45D2C")
                                    .setButtonTextColor("#FFFFFF")
                                    .setPrimaryTextColor("#0F172A")
                                    .setSecondaryTextColor("#64748B")
                                    .build();

                            CFDropCheckoutPayment cfDrop = new CFDropCheckoutPayment.CFDropCheckoutPaymentBuilder()
                                    .setSession(cfSession)
                                    .setCFNativeCheckoutUITheme(cfTheme)
                                    .build();

                            android.util.Log.i("KhanaGharTak", "Executing Cashfree Native Drop Checkout: order=" + finalOrderId);
                            CFPaymentGatewayService.getInstance().doPayment(MainActivity.this, cfDrop);
                        } catch (Exception e) {
                            android.util.Log.e("KhanaGharTak", "Native Drop Checkout failed", e);
                            Toast.makeText(MainActivity.this, "Could not open checkout. Please try again.", Toast.LENGTH_SHORT).show();
                            resetCheckoutCta("Payment could not be started");
                        }
                    }
                });
            }
        }).start();
    }

    public void launchCashfreeDropCheckout(final String paymentSessionId, final String orderId, final String mode) {
        if (paymentSessionId == null || paymentSessionId.trim().isEmpty()) {
            android.util.Log.e("KhanaGharTak", "paymentSessionId is null or empty");
            resetCheckoutCta("Payment session error. Please tap Pay Online again.");
            return;
        }

        currentPaymentSessionId = paymentSessionId.trim();
        lastPaymentOrderId = (orderId != null && !orderId.trim().isEmpty()) ? orderId.trim() : null;
        currentPaymentMode = (mode != null && !mode.trim().isEmpty()) ? mode.trim() : "PRODUCTION";
        showNativePaymentOptionsDialog(currentPaymentSessionId, lastPaymentOrderId, currentPaymentMode);
    }


    private void resetCheckoutCta(final String message) {
        runOnUiThread(() -> {
            if (bridge != null && bridge.getWebView() != null) {
                final String safeMsg = (message != null ? message : "Payment was cancelled").replace("'", "\\'");
                bridge.getWebView().evaluateJavascript(
                    "if (typeof window.__kgt_on_cashfree_error === 'function') window.__kgt_on_cashfree_error('" + safeMsg + "');",
                    null
                );
            }
        });
    }

    @Override
    public void onPaymentVerify(final String orderId) {
        android.util.Log.i("KhanaGharTak", "Cashfree onPaymentVerify: " + orderId);
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (bridge != null && bridge.getWebView() != null) {
                    String script = String.format(java.util.Locale.US,
                        "(function() { " +
                        "  var target = '/payment/cashfree/return?cf_order_id=%s'; " +
                        "  if (typeof window.__kgt_customer_navigate === 'function') { " +
                        "    window.__kgt_customer_navigate(target); " +
                        "  } else { " +
                        "    window.location.href = target; " +
                        "  } " +
                        "})();",
                        orderId
                    );
                    bridge.getWebView().evaluateJavascript(script, null);
                }
            }
        });
    }

    @Override
    public void onPaymentFailure(final CFErrorResponse cfErrorResponse, final String orderId) {
        final String msg = cfErrorResponse != null ? cfErrorResponse.getMessage() : "Payment was cancelled or failed";
        android.util.Log.w("KhanaGharTak", "Cashfree onPaymentFailure: " + msg + " for order: " + orderId);
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (bridge != null && bridge.getWebView() != null) {
                    final String safeMsg = (msg != null ? msg : "Payment was cancelled").replace("'", "\\'");
                    String script = String.format(java.util.Locale.US,
                        "(function() { " +
                        "  if (typeof window.__kgt_on_cashfree_error === 'function') { " +
                        "    window.__kgt_on_cashfree_error('%s'); " +
                        "  } else { " +
                        "    console.warn('Payment failed/cancelled: %s'); " +
                        "  } " +
                        "})();",
                        safeMsg, safeMsg
                    );
                    bridge.getWebView().evaluateJavascript(script, null);
                }
            }
        });
    }

    public static class CashfreeJavascriptInterface {
        private final java.lang.ref.WeakReference<MainActivity> activityRef;

        public CashfreeJavascriptInterface(MainActivity activity) {
            this.activityRef = new java.lang.ref.WeakReference<>(activity);
        }

        @JavascriptInterface
        public void startPayment(final String paymentSessionId, final String orderId, final String mode) {
            final MainActivity activity = activityRef.get();
            if (activity != null) {
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        activity.launchCashfreeDropCheckout(paymentSessionId, orderId, mode);
                    }
                });
            }
        }
    }
}

