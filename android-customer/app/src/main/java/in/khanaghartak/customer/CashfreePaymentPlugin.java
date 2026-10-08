package in.khanaghartak.customer;

import android.net.Uri;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CashfreePayment")
public class CashfreePaymentPlugin extends Plugin {
    private static final String TAG = "KGT-CashfreePlugin";

    @PluginMethod
    public void startPayment(final PluginCall call) {
        final String paymentSessionId = call.getString("paymentSessionId", "");
        final String orderId = call.getString("orderId", "");
        final String mode = call.getString("mode", "PRODUCTION");

        Log.d(TAG, "Plugin startPayment invoked: session=" + paymentSessionId + ", orderId=" + orderId + ", mode=" + mode);

        MainActivity activity = (MainActivity) getActivity();
        if (activity != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    activity.launchCashfreeDropCheckout(paymentSessionId, orderId, mode);
                }
            });
            call.resolve();
        } else {
            Log.e(TAG, "MainActivity is null during startPayment");
            call.reject("MainActivity not available");
        }
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url != null && "kgt-cashfree".equalsIgnoreCase(url.getScheme())) {
            final String paymentSessionId = url.getQueryParameter("paymentSessionId") != null
                    ? url.getQueryParameter("paymentSessionId")
                    : "";
            final String orderId = url.getQueryParameter("orderId") != null
                    ? url.getQueryParameter("orderId")
                    : "";
            final String mode = url.getQueryParameter("mode") != null
                    ? url.getQueryParameter("mode")
                    : "PRODUCTION";

            Log.d(TAG, "shouldOverrideLoad intercepted kgt-cashfree scheme: session=" + paymentSessionId + ", orderId=" + orderId);

            MainActivity activity = (MainActivity) getActivity();
            if (activity != null) {
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        activity.launchCashfreeDropCheckout(paymentSessionId, orderId, mode);
                    }
                });
            }
            return Boolean.TRUE;
        }
        return super.shouldOverrideLoad(url);
    }
}
