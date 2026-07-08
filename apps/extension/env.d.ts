interface ImportMetaEnv {
  /** WebSocket URL (or bare host, treated as wss://) of the default sync hub. */
  readonly VITE_DEFAULT_HUB?: string;
  /** URL of the full Cue web app the popup's "open cue" link points at. */
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
