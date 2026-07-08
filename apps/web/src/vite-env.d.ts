/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket URL of the default sync hub (e.g. wss://cue-hub.onrender.com). */
  readonly VITE_DEFAULT_HUB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
