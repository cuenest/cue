import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Persisted desktop preferences (stored as JSON under the app's userData). */
export interface DesktopSettings {
  /** Whether this device hosts a sync hub for other devices. */
  hubMode: boolean;
  /** Port the embedded hub listens on (defaults to the hub's own default). */
  hubPort?: number;
}

const DEFAULTS: DesktopSettings = { hubMode: false };

export function loadSettings(file: string): DesktopSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(readFileSync(file, 'utf8')) as Partial<DesktopSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(file: string, settings: DesktopSettings): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2));
}
