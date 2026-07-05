import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Cue — capture anything',
    description:
      'Local-first quick capture into your Cue queue. Zero-knowledge sync with your other devices.',
    permissions: ['contextMenus', 'storage'],
  },
});
