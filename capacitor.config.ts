import type { CapacitorConfig } from '@capacitor/cli';

// The APK is a thin shell over the live Pages deploy, so every web deploy updates the phone app.
// offline.html is bundled and shown when the live URL cannot be reached.
const config: CapacitorConfig = {
  appId: 'com.lighthouse.mess',
  appName: 'Light House',
  webDir: 'dist',
  backgroundColor: '#050807',
  server: {
    url: 'https://julfikerhaider2001.github.io/Light-House-Management/',
    errorPath: 'offline.html',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
