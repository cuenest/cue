/**
 * Context-menu captures land here (chrome.storage.local) because the MV3
 * background worker is ephemeral and must not own a Yjs document. The popup
 * drains this queue into the engine next time it opens.
 */

const KEY = 'cuePending';

/** Structural subset of chrome.storage.local so tests can use an in-memory fake. */
export interface KVArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

async function read(area: KVArea): Promise<string[]> {
  const out = (await area.get(KEY))[KEY];
  return Array.isArray(out) ? (out as string[]) : [];
}

export async function addPending(area: KVArea, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const current = await read(area);
  await area.set({ [KEY]: [...current, trimmed] });
}

/** Moves every pending capture into the engine. Returns how many were drained. */
export async function drainPending(
  area: KVArea,
  addItem: (body: string) => unknown,
): Promise<number> {
  const current = await read(area);
  for (const body of current) addItem(body);
  if (current.length > 0) await area.set({ [KEY]: [] });
  return current.length;
}
