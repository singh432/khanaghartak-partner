import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token, type ActionPerformed, type PushNotificationSchema } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let isRegistered = false;

/** Registers device with FCM and synchronizes token with Supabase backend */
export async function setupPushNotifications(
  userId: string,
  appType: "customer" | "partner",
  role: "customer" | "restaurant" | "rider" | "zone_manager" = "customer"
) {
  if (!Capacitor.isNativePlatform()) return;
  if (isRegistered) return;

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      console.warn("Push notification permission denied by user.");
      return;
    }

    await PushNotifications.register();
    isRegistered = true;

    // Listen for FCM token generation
    await PushNotifications.addListener("registration", async (token: Token) => {
      if (!token?.value) return;
      try {
        localStorage.setItem("kgt:fcm-token", token.value);
        await (supabase.from("user_fcm_tokens" as any) as any).upsert(
          {
            user_id: userId,
            token: token.value,
            app_type: appType,
            role: role,
            platform: "android",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token" }
        );
      } catch (err) {
        console.error("Failed to save FCM token to Supabase:", err);
      }
    });

    // Listen for incoming foreground push notifications
    await PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
      console.log("Push notification received in foreground:", notification.title);
      if (notification.title || notification.body) {
        toast(notification.title || "KhanaGharTak", {
          description: notification.body,
        });
      }
    });

    // Handle user tapping the notification in system tray
    await PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
      const data = action.notification.data as Record<string, unknown> | undefined;
      if (data?.order_id && typeof data.order_id === "string") {
        window.location.href = `/order/${data.order_id}`;
      } else if (appType === "partner") {
        if (role === "restaurant") window.location.href = "/admin/orders";
        else if (role === "rider") window.location.href = "/rider";
        else if (role === "zone_manager") window.location.href = "/zone";
      }
    });
  } catch (err) {
    console.warn("Error setting up push notifications:", err);
  }
}

/** Clears push notification listeners on user sign out */
export async function clearPushNotifications() {
  if (!Capacitor.isNativePlatform() || !isRegistered) return;
  try {
    await PushNotifications.removeAllListeners();
    isRegistered = false;
  } catch (err) {
    console.warn("Error removing push notification listeners:", err);
  }
}
