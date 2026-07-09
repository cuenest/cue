import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pinned so the desktop shell (--dev-url) and the extension's "open cue" link,
  // which both target 5178, connect to the dev server reliably.
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
});
