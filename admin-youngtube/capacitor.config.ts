import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.youngtube.admin',
  appName: 'YoungTube Admin',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
