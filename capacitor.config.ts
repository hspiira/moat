import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.piira.moat',
  appName: 'Moat',
  webDir: 'out',
  ios: {
    contentInset: 'never',
  },
};

export default config;
