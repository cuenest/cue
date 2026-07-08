import { useEffect, useRef } from 'react';
import type { Item } from '@cue/engine';

/** True when the browser exposes the Notification API and the user granted it. */
export function canNotify(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Fires one OS notification per scheduled item as it crosses its due time.
 * De-duped by item id in a ref, and persisted to localStorage so a reload
 * doesn't re-notify for items that already fired. Pure client-side.
 */
export function useDueNotifications(items: Item[], now: number): void {
  const notified = useRef<Set<string>>(loadNotified());

  useEffect(() => {
    if (!canNotify()) return;
    let changed = false;
    for (const item of items) {
      if (
        item.status === 'scheduled' &&
        typeof item.dueAt === 'number' &&
        item.dueAt <= now &&
        !notified.current.has(item.id)
      ) {
        notified.current.add(item.id);
        changed = true;
        try {
          new Notification('Cue — due now', { body: item.body, tag: `cue-${item.id}` });
        } catch {
          /* some engines throw if called outside a user gesture — ignore */
        }
      }
    }
    // forget ids that are no longer scheduled, so a requeue can re-notify later
    const live = new Set(items.filter((i) => i.status === 'scheduled').map((i) => i.id));
    for (const id of notified.current) {
      if (!live.has(id)) {
        notified.current.delete(id);
        changed = true;
      }
    }
    if (changed) saveNotified(notified.current);
  }, [items, now]);
}

const STORAGE = 'cue-notified';

function loadNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotified(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE, JSON.stringify([...set]));
  } catch {
    /* private mode */
  }
}
