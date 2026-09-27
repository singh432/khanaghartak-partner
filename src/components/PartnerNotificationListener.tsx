import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isPartnerApp, nativeHaptics } from "@/lib/capacitor";

/** Plays an energetic notification chime using the Web Audio API */
function playOrderAlertSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const playTone = (freq: number, start: number, duration: number, type: OscillatorType = "sine") => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(880, now, 0.25, "sawtooth");
    playTone(1320, now + 0.15, 0.35, "sine");
    playTone(1760, now + 0.3, 0.5, "sawtooth");
  } catch (err) {
    console.warn("Could not play audio chime:", err);
  }
}

/** Triggers full continuous siren, native notification, vibration, and in-app banner */
export function firePartnerOrderAlert(
  orderId: string,
  role: "restaurant" | "rider" | "zone_manager",
  title: string,
  body: string,
  targetUrl?: string
) {
  // 1. Play Web Audio chime
  playOrderAlertSound();

  // 2. Trigger native haptic feedback
  try {
    nativeHaptics.warning();
  } catch {}

  // 3. Trigger Native Android Insistent Continuous Alarm (Sound + Vibration + Tray Notification)
  try {
    if (
      (window as any).AndroidAlert &&
      typeof (window as any).AndroidAlert.startContinuousAlarm === "function"
    ) {
      (window as any).AndroidAlert.startContinuousAlarm(orderId, role, title, body);
    }
  } catch (e) {
    console.warn("Failed to call AndroidAlert.startContinuousAlarm:", e);
  }

  // 4. Trigger Injected In-App Banner & Web Audio Alarm Loop
  try {
    if (typeof (window as any).__kgt_start_order_alarm === "function") {
      (window as any).__kgt_start_order_alarm(orderId, role, title, body);
    }
  } catch {}

  // 5. High-Priority In-App Toast
  const destUrl =
    targetUrl ||
    (role === "rider" ? "/rider" : role === "zone_manager" ? "/zone" : "/admin/orders");

  toast.success(title, {
    description: body,
    duration: 15000,
    action: {
      label: "View & Accept",
      onClick: () => {
        try {
          if (
            (window as any).AndroidAlert &&
            typeof (window as any).AndroidAlert.stopContinuousAlarm === "function"
          ) {
            (window as any).AndroidAlert.stopContinuousAlarm();
          }
          if (typeof (window as any).__kgt_stop_order_alarm === "function") {
            (window as any).__kgt_stop_order_alarm();
          }
        } catch {}
        window.location.href = destUrl;
      },
    },
  });

  // 6. Dispatch custom event for active pages to react and reload
  window.dispatchEvent(
    new CustomEvent("kgt:partner-order-alert", {
      detail: { orderId, role, title, body },
    })
  );
}

/** Silences any active alarm sound and vibration */
export function silencePartnerOrderAlert() {
  try {
    if (
      (window as any).AndroidAlert &&
      typeof (window as any).AndroidAlert.stopContinuousAlarm === "function"
    ) {
      (window as any).AndroidAlert.stopContinuousAlarm();
    }
  } catch {}
  try {
    if (typeof (window as any).__kgt_stop_order_alarm === "function") {
      (window as any).__kgt_stop_order_alarm();
    }
  } catch {}
}

/**
 * Universal active notification watchdog for the KhanaGharTak Partner App.
 * Runs an active heartbeat every 5 seconds plus Supabase Realtime fallback.
 * Checks for incoming orders and offers across Restaurant, Rider, and Zone Manager roles.
 */
export function PartnerNotificationListener() {
  const { user, isZoneManager, isAdmin, isRider, primaryPartnerRole } = useAuth();
  const partnerApp = isPartnerApp();
  const seenIdsRef = useRef(new Set<string>());
  const cachedZoneIdRef = useRef<string | null>(null);

  // Expose controls globally so any component can invoke them
  useEffect(() => {
    (window as any).__kgt_fire_order_alert = firePartnerOrderAlert;
    (window as any).__kgt_silence_alarm = silencePartnerOrderAlert;
  }, []);

  // Determine active partner role
  const isRestaurantPartner = isAdmin || primaryPartnerRole === "restaurant";
  const isRiderPartner = isRider || primaryPartnerRole === "rider";
  const isZonePartner = isZoneManager || primaryPartnerRole === "zone_manager";
  const isAnyPartner = isRestaurantPartner || isRiderPartner || isZonePartner || partnerApp;

  // Active Order Watchdog Poller (runs every 5 seconds for reliable foreground delivery)
  useEffect(() => {
    if (!user || !isAnyPartner) return;

    let active = true;

    const checkActiveOrders = async () => {
      if (!active) return;

      try {
        // 1. Restaurant Owner Check: Polls for unaccepted 'placed' orders
        if (isRestaurantPartner) {
          const { data, error } = await supabase.rpc("owner_list_orders" as any, {
            _limit: 20,
          });
          if (!error && Array.isArray(data)) {
            const placedOrders = data.filter((o: any) => o.status === "placed");
            for (const order of placedOrders) {
              if (!seenIdsRef.current.has(order.id)) {
                seenIdsRef.current.add(order.id);
                const shortId = order.id.slice(0, 8).toUpperCase();
                const totalAmt = Math.round(Number(order.total) || 0);
                const cust = order.customer_first_name || "Customer";
                firePartnerOrderAlert(
                  order.id,
                  "restaurant",
                  "🚨 NEW ORDER RECEIVED!",
                  `Order #${shortId} · ₹${totalAmt} from ${cust} · Tap to Accept!`,
                  "/admin/orders"
                );
              }
            }
          }
        }

        // 2. Rider Check: Polls for available delivery offers
        if (isRiderPartner) {
          const { data, error } = await supabase.rpc("rider_list_offers" as any);
          if (!error && Array.isArray(data) && data.length > 0) {
            for (const offer of data) {
              if (!seenIdsRef.current.has(offer.order_id)) {
                seenIdsRef.current.add(offer.order_id);
                const drop = offer.drop_area || "Customer Delivery";
                const totalAmt = Math.round(Number(offer.total) || 0);
                firePartnerOrderAlert(
                  offer.order_id,
                  "rider",
                  "🛵 NEW DELIVERY OFFER!",
                  `Drop: ${drop} · ₹${totalAmt} · Tap to Accept Offer!`,
                  "/rider"
                );
              }
            }
          }
        }

        // 3. Zone Manager Check: Polls for unassigned orders in their zone
        if (isZonePartner) {
          let zId = cachedZoneIdRef.current;
          if (!zId) {
            const { data: zmRow } = await supabase
              .from("zone_managers")
              .select("zone_id")
              .eq("user_id", user.id)
              .maybeSingle();
            if (zmRow?.zone_id) {
              zId = zmRow.zone_id;
              cachedZoneIdRef.current = zId;
            }
          }

          if (zId) {
            const { data, error } = await supabase.rpc("zone_list_orders" as any, {
              _zone_id: zId,
              _limit: 20,
            });
            if (!error && Array.isArray(data)) {
              const pendingOrders = data.filter(
                (o: any) => o.status === "placed" && !o.rider_id
              );
              for (const order of pendingOrders) {
                if (!seenIdsRef.current.has(order.id)) {
                  seenIdsRef.current.add(order.id);
                  const shortId = order.id.slice(0, 8).toUpperCase();
                  firePartnerOrderAlert(
                    order.id,
                    "zone_manager",
                    "📦 UNASSIGNED ORDER IN ZONE!",
                    `Order #${shortId} needs dispatch in your zone.`,
                    "/zone"
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Partner notification watchdog error:", err);
      }
    };

    // Run initial check immediately
    void checkActiveOrders();

    // Heartbeat poll every 5 seconds
    const interval = setInterval(checkActiveOrders, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user, isAnyPartner, isRestaurantPartner, isRiderPartner, isZonePartner]);

  // Fallback Realtime Channel (for partner_notifications if populated in DB)
  useEffect(() => {
    if (!user || !isAnyPartner) return;

    const channel = supabase
      .channel(`partner-notifs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "partner_notifications",
          filter: `target_user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as {
            id: string;
            order_id: string | null;
            title: string;
            body: string;
            target_role: "restaurant" | "rider" | "zone_manager";
          };

          if (!notif || seenIdsRef.current.has(notif.id)) return;
          seenIdsRef.current.add(notif.id);

          firePartnerOrderAlert(
            notif.order_id || notif.id,
            notif.target_role || "restaurant",
            notif.title || "🚨 NEW ORDER RECEIVED!",
            notif.body || "New order requires immediate attention."
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, isAnyPartner]);

  return null;
}
