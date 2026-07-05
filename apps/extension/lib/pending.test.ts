import { describe, it, expect } from 'vitest';
import { addPending, drainPending, type KVArea } from './pending';

function fakeArea(): KVArea & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: (key) => Promise.resolve({ [key]: data[key] }),
    set: (items) => {
      Object.assign(data, items);
      return Promise.resolve();
    },
  };
}

describe('pending capture queue', () => {
  it('addPending appends trimmed bodies', async () => {
    const area = fakeArea();
    await addPending(area, '  first  ');
    await addPending(area, 'second');
    expect(area.data.cuePending).toEqual(['first', 'second']);
  });

  it('addPending ignores empty input', async () => {
    const area = fakeArea();
    await addPending(area, '   ');
    expect(area.data.cuePending).toBeUndefined();
  });

  it('drainPending feeds the engine and clears the queue', async () => {
    const area = fakeArea();
    await addPending(area, 'a');
    await addPending(area, 'b');
    const captured: string[] = [];
    const n = await drainPending(area, (b) => captured.push(b));
    expect(n).toBe(2);
    expect(captured).toEqual(['a', 'b']);
    expect(area.data.cuePending).toEqual([]);
  });

  it('drainPending on empty queue is a no-op', async () => {
    const area = fakeArea();
    const n = await drainPending(area, () => {
      throw new Error('should not be called');
    });
    expect(n).toBe(0);
  });
});
