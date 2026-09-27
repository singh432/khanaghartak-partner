package in.khanaghartak.customer;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import com.google.android.gms.auth.api.phone.SmsRetriever;
import com.google.android.gms.auth.api.phone.SmsRetrieverClient;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Status;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    private static final int SMS_CONSENT_REQUEST = 1002;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1003;

    private BroadcastReceiver smsVerificationReceiver;
    private boolean isSmsConsentRegistered = false;

    private static final double SERVICE_CENTER_LAT = 25.1842;
    private static final double SERVICE_CENTER_LNG = 81.6212;
    private static final double SERVICE_RADIUS_KM = 10.0;

    private static final double[][] SHANKARGARH_POLYGON = {
        {25.226876, 81.584642},
        {25.225354, 81.619860},
        {25.219242, 81.647636},
        {25.218954, 81.667853},
        {25.212449, 81.685936},
        {25.200505, 81.672039},
        {25.184447, 81.655593},
        {25.155628, 81.645967},
        {25.160616, 81.600931},
        {25.177561, 81.592403},
        {25.197182, 81.559681}
    };

    private boolean isOutsideServiceZone = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

        if (this.bridge != null) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                try {
                    String ua = webView.getSettings().getUserAgentString();
                    if (!ua.contains("KhanaGharTakCustomerApp")) {
                        webView.getSettings().setUserAgentString(ua + " KhanaGharTakCustomerApp");
                    }
                } catch (Exception ignored) {}
                webView.addJavascriptInterface(new OtpJavascriptInterface(), "AndroidOtp");
                webView.addJavascriptInterface(new AppJavascriptInterface(), "AndroidApp");
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
        try {
            LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) return;

            Location bestLocation = null;
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {

                Location gpsLoc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                Location netLoc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);

                if (gpsLoc != null && netLoc != null) {
                    bestLocation = (gpsLoc.getTime() > netLoc.getTime()) ? gpsLoc : netLoc;
                } else if (gpsLoc != null) {
                    bestLocation = gpsLoc;
                } else {
                    bestLocation = netLoc;
                }
            }

            if (bestLocation != null) {
                processCoordinates(bestLocation.getLatitude(), bestLocation.getLongitude());
            } else {
                requestSingleUpdate(lm);
            }
        } catch (SecurityException ignored) {
        } catch (Exception ignored) {}
    }

    private void requestSingleUpdate(final LocationManager lm) {
        try {
            LocationListener listener = new LocationListener() {
                @Override
                public void onLocationChanged(@NonNull Location location) {
                    processCoordinates(location.getLatitude(), location.getLongitude());
                    try {
                        lm.removeUpdates(this);
                    } catch (SecurityException ignored) {}
                }
                @Override
                public void onProviderDisabled(@NonNull String provider) {}
                @Override
                public void onProviderEnabled(@NonNull String provider) {}
            };

            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, listener);
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, listener);
            }
        } catch (SecurityException ignored) {}
    }

    private void processCoordinates(double lat, double lng) {
        boolean inside = isWithinServiceZone(lat, lng);
        isOutsideServiceZone = !inside;

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().post(new Runnable() {
                @Override
                public void run() {
                    String coordScript = String.format(java.util.Locale.US,
                        "try { " +
                        "  window.__native_device_coords = {lat: %f, lng: %f, ts: Date.now()}; " +
                        "  window.__native_device_outside = %s; " +
                        "  localStorage.setItem('kgt:device-outside', '%s'); " +
                        "  if (!localStorage.getItem('kgt:delivery-address')) { " +
                        "    localStorage.setItem('kgt:user-coords', JSON.stringify(window.__native_device_coords)); " +
                        "  } " +
                        "  window.dispatchEvent(new Event('storage')); " +
                        "  window.dispatchEvent(new Event('kgt:address-changed')); " +
                        "} catch(e){}",
                        lat, lng, (isOutsideServiceZone ? "true" : "false"), (isOutsideServiceZone ? "true" : "false")
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
        double dist = haversineKm(lat, lng, SERVICE_CENTER_LAT, SERVICE_CENTER_LNG);
        return dist <= SERVICE_RADIUS_KM;
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
}

