import { DEFAULT_CHUNK_SIZE, type FileManifest } from '@cue/engine';

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf';

/** Which files can be previewed inline (the rest just download). */
export function previewKind(mime: string): PreviewKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return null;
}

let registered: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerFileWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registered) return registered;
  registered =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker.register('/cue-sw.js').catch(() => null)
      : Promise.resolve(null);
  return registered;
}

/**
 * Hand the worker everything it needs to stream this file, then return the
 * virtual URL to point an <img>/<video>/<audio>/<iframe> at.
 */
export async function preparePreview(
  manifest: FileManifest,
  transport: { hub: string; room: string; key: string },
): Promise<string> {
  await registerFileWorker();
  const ready = await navigator.serviceWorker.ready;
  const info = {
    httpHub: transport.hub.replace(/^ws/, 'http').replace(/\/+$/, ''),
    room: transport.room,
    key: transport.key,
    chunkHashes: manifest.chunkHashes,
    chunkSize: DEFAULT_CHUNK_SIZE,
    size: manifest.size,
    mime: manifest.mime,
  };
  await saveInfo(manifest.id, info); // durable: survives the SW being recycled while idle
  ready.active?.postMessage({ type: 'cue-file', id: manifest.id, info });
  return `/cue-file/${encodeURIComponent(manifest.id)}`;
}

/** Persist file info so the worker can rebuild it after a restart (SW memory is ephemeral). */
function saveInfo(id: string, info: unknown): Promise<void> {
  return new Promise((resolve) => {
    const r = indexedDB.open('cue-fileinfo', 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('info')) r.result.createObjectStore('info');
    };
    r.onsuccess = () => {
      try {
        const t = r.result.transaction('info', 'readwrite');
        t.objectStore('info').put(info, id);
        t.oncomplete = () => resolve();
        t.onerror = () => resolve();
      } catch {
        resolve();
      }
    };
    r.onerror = () => resolve();
  });
}
