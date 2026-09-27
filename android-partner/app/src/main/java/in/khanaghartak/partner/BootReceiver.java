package in.khanaghartak.partner;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "android.intent.action.QUICKBOOT_POWERON".equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            try {
                SharedPreferences prefs = context.getSharedPreferences("kgt_partner_prefs", Context.MODE_PRIVATE);
                String token = prefs.getString("access_token", null);
                if (token != null && !token.trim().isEmpty()) {
                    PartnerForegroundService.startService(context);
                }
            } catch (Exception ignored) {}
        }
    }
}
