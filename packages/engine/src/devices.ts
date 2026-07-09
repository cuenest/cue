/**
 * A device registry shared across a space. Each device that joins writes itself
 * here (in the synced doc), so every device can see who shares the space. This
 * is the visibility layer — and the foundation a future membership/revocation
 * model (per-person keys) would build on.
 */
export interface DeviceInfo {
  /** Stable per-install id (random, kept in local storage). */
  id: string;
  /** Human label, e.g. "Kent's phone" or a derived default. */
  name: string;
  /** Which surface it is: web | extension | desktop | mobile. */
  surface: string;
  /** First time this device announced itself in the space. */
  addedAt: number;
  /** Last heartbeat — used to show online/last-seen. */
  lastSeen: number;
}

/** Online if seen within this window (heartbeats are more frequent). */
export const DEVICE_ONLINE_MS = 45_000;

export function isOnline(d: DeviceInfo, now: number = Date.now()): boolean {
  return now - d.lastSeen < DEVICE_ONLINE_MS;
}
