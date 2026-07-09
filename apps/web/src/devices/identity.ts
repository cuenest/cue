import { useEffect } from 'react';
import type { CueEngine } from '@cue/engine';

const ID_KEY = 'cue-device-id';
const NAME_KEY = 'cue-device-name';

/** Stable id for this install (generated once, kept locally). */
export function deviceId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(ID_KEY, id);
    } catch {
      /* private mode: id lives for the session */
    }
  }
  return id;
}

/** Which shell is running this web build. */
export function deviceSurface(): string {
  if (typeof window !== 'undefined' && (window as { Capacitor?: unknown }).Capacitor) return 'mobile';
  if (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)) return 'desktop';
  return 'web';
}

export function defaultDeviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'device';
  const app =
    deviceSurface() === 'desktop'
      ? 'Desktop'
      : /Edg\//.test(ua)
        ? 'Edge'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Cue';
  return `${app} on ${os}`;
}

export function deviceName(): string {
  return localStorage.getItem(NAME_KEY) || defaultDeviceName();
}

export function setDeviceName(name: string): void {
  const n = name.trim();
  try {
    if (n) localStorage.setItem(NAME_KEY, n);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Announce this device in the active space and heartbeat so others see it as
 * online. Re-runs when the active engine (space) changes, so switching to a
 * shared space registers this device there.
 */
export function usePresence(engine: CueEngine): void {
  useEffect(() => {
    const id = deviceId();
    const announce = () =>
      engine.registerDevice({ id, name: deviceName(), surface: deviceSurface() });
    announce();
    const beat = setInterval(() => engine.touchDevice(id), 20_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') announce();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(beat);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [engine]);
}
