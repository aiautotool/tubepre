import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.KVTUBE_ANDROID_SERVER_URL || 'http://103.116.38.112:5011';

const config: CapacitorConfig = {
  appId: 'io.kvtube.app',
  appName: 'Premium',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: true,
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
