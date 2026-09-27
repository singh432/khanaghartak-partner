import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Geolocation } from "@capacitor/geolocation";

export type NativeAppType = "customer" | "partner" | "web";

let initialized = false;
let lastBackPress = 0;

/** Checks if running in native Android or iOS via Capacitor */
export const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();

/**
 * Detects synchronously whether this runtime is the Partner Android App.
 */
export function isPartnerApp(): boolean {
  if (typeof window !== "undefined") {
    if ((window as any).__is_partner_app === true) return true;
    try {
      if (localStorage.getItem("kgt:app-flavor") === "partner") return true;
    } catch {}
  }
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("KhanaGharTakPartnerApp")) {
    return true;
  }
  return false;
}

/**
 * Detects synchronously whether this runtime is the Customer Android App.
 */
export function isCustomerApp(): boolean {
  if (isPartnerApp()) return false;
  if (typeof window !== "undefined") {
    if ((window as any).__is_partner_app === true) return false;
    try {
      if (localStorage.getItem("kgt:app-flavor") === "partner") return false;
      if (localStorage.getItem("kgt:app-flavor") === "customer") return true;
    } catch {}
  }
  if (typeof navigator !== "undefined") {
    if (navigator.userAgent.includes("KhanaGharTakPartnerApp")) return false;
    if (navigator.userAgent.includes("KhanaGharTakCustomerApp")) return true;
  }
  if (!isNative) return false;
  // If native but not partner, verify it is truly customer
  return !isPartnerApp();
}

/** Returns the active application runtime type */
export function getAppType(): NativeAppType {
  if (isPartnerApp()) return "partner";
  if (isCustomerApp()) return "customer";
  return "web";
}

/** Initializes native device behaviors (Status bar, Splash screen, Hardware back button) */
export async function initNativeAppShell(onNavigateBack?: () => boolean | void) {
  if (!isNative || initialized) return;
  initialized = true;

  try {
    const appType = getAppType();

    // 1. Status Bar Setup
    if (appType === "partner") {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: "#FFFFFF" });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } else {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#F45D2C" });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (err) {
    console.warn("StatusBar init error:", err);
  }

  // 2. Hide Splash Screen smoothly once UI is mounted
  try {
    await SplashScreen.hide();
  } catch (err) {
    console.warn("SplashScreen hide error:", err);
  }

  // 3. Android Hardware Back Button Handling
  try {
    await App.addListener("backButton", ({ canGoBack }) => {
      const currentPath = window.location.pathname;

      if (onNavigateBack) {
        const handled = onNavigateBack();
        if (handled) return;
      }

      // If at home, root, login, or top dashboards, double-tap to exit
      if (
        currentPath === "/home" ||
        currentPath === "/" ||
        currentPath === "/login" ||
        currentPath === "/admin" ||
        currentPath === "/rider" ||
        currentPath === "/zone"
      ) {
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          App.exitApp();
        } else {
          lastBackPress = now;
          void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }
        return;
      }

      // Otherwise navigate back in browser history
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (err) {
    console.warn("BackButton listener error:", err);
  }
}

/** Native Haptic Feedback */
export const nativeHaptics = {
  selection: () => {
    if (!isNative) return;
    Haptics.selectionChanged().catch(() => {});
  },
  success: () => {
    if (!isNative) return;
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  },
  warning: () => {
    if (!isNative) return;
    Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  },
  error: () => {
    if (!isNative) return;
    Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  },
  impact: (style: ImpactStyle = ImpactStyle.Medium) => {
    if (!isNative) return;
    Haptics.impact({ style }).catch(() => {});
  },
};

/** High-accuracy GPS position from native device GPS */
export async function getNativePosition(): Promise<{ lat: number; lng: number } | null> {
  if (!isNative) return null;
  try {
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted") {
      perm = await Geolocation.requestPermissions();
    }
    if (perm.location !== "granted") return null;

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 10000,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };
  } catch (err) {
    console.warn("Native Geolocation error:", err);
    return null;
  }
}
