import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.khanaghartak.partner',
  appName: 'KhanaGharTak Partner',
  webDir: 'dist',
  appendUserAgent: 'KhanaGharTakPartnerApp',
  server: {
    url: 'https://khanaghartak.in/login',
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
    path: 'android-partner',
    allowMixedContent: false,
    backgroundColor: '#FFFFFF',
    buildOptions: {
      releaseType: 'AAB',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#FFFFFF',
      style: 'LIGHT',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
