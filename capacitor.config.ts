import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'be.kidsatletiekdehaan.tijdregistratie',
  appName: 'Tijdregistratie',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'tijdregistratie.local',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
