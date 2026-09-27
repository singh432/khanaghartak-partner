import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.khanaghartak.customer',
  appName: 'KhanaGharTak',
  webDir: 'dist',
  appendUserAgent: 'KhanaGharTakCustomerApp',
  server: {
    url: 'https://khanaghartak.in/home',
    cleartext: false,
    allowNavigation: [
      'khanaghartak.in',
      '*.khanaghartak.in',
      '*.supabase.co',
      '*.msg91.com',
      '*.tile.openstreetmap.org',
      'nominatim.openstreetmap.org',
      'maps.googleapis.com',
    ],
  },
  android: {
    path: 'android-customer',
    allowMixedContent: false,
    backgroundColor: '#F45D2C',
    buildOptions: {
      releaseType: 'AAB',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#F45D2C',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#F45D2C',
      style: 'DARK',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
