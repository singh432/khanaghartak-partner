package in.khanaghartak.partner;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class AlarmDismissReceiver extends BroadcastReceiver {
    private static final String TAG = "KGT_AlarmDismiss";
    public static final String ACTION_DISMISS_ALARM = "in.khanaghartak.partner.ACTION_DISMISS_ALARM";
    public static final String EXTRA_NOTIFICATION_ID = "notification_id";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "Received broadcast action: " + action);

        if (ACTION_DISMISS_ALARM.equals(action)) {
            // 1. Stop auxiliary siren in FCM Service
            PartnerFirebaseMessagingService.stopAuxiliarySiren();

            // 2. Stop in-activity continuous alarm if running
            MainActivity activity = MainActivity.getInstance();
            if (activity != null) {
                activity.stopContinuousAlarm();
            }

            // 3. Cancel the notification from system tray
            int notifId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1);
            if (notifId != -1) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(notifId);
                }
            }
        }
    }
}
