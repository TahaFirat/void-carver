import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tahafirat.voidcarver',
  appName: 'Void Carver',
  webDir: 'dist',
  backgroundColor: '#05070D',
  ios: {
    contentInset: 'never',
    backgroundColor: '#05070D',
    preferredContentMode: 'mobile'
  },
  android: {
    backgroundColor: '#05070D'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      backgroundColor: '#05070D',
      showSpinner: false
    },
    SystemBars: {
      hidden: true,
      style: 'DARK',
      animation: 'NONE'
    }
  }
};

export default config;
