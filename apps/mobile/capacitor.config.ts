import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.cuenest.cue',
  appName: 'Cue',
  // the mobile shell wraps the built web app — one codebase, every surface
  webDir: '../web/dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    // ws:// to a LAN/self-hosted hub from a native app context
    cleartext: true,
  },
};

export default config;
