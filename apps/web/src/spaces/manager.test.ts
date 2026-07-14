import { describe, it, expect, beforeEach } from 'vitest';
import { keyringFromLegacy, rotateKeyring } from '@cue/engine';
import { spaceManager, spaceKeyring, type SpaceInfo } from './manager';

const LIST_KEY = 'cue-spaces';

function seed(spaces: Partial<SpaceInfo>[]): void {
  localStorage.setItem(LIST_KEY, JSON.stringify(spaces));
}

beforeEach(() => {
  localStorage.clear();
});

describe('spaceKeyring migration', () => {
  it('a legacy stored space (room+key only) yields an epoch-0 keyring', () => {
    seed([{ id: 's1', name: 'S', room: 'r0', key: 'k0', hub: 'ws://h' }]);
    const kr = spaceKeyring(spaceManager.list()[0]!);
    expect(kr).toEqual({ current: 0, epochs: [{ epoch: 0, key: 'k0', room: 'r0' }] });
  });

  it('a rotated space stores and restores its full history', async () => {
    const rotated = await rotateKeyring(keyringFromLegacy('k0', 'r0'));
    seed([
      {
        id: 's1',
        name: 'S',
        hub: 'ws://h',
        room: rotated.epochs[1]!.room,
        key: rotated.epochs[1]!.key,
        epochs: rotated.epochs,
        current: rotated.current,
      },
    ]);
    expect(spaceKeyring(spaceManager.list()[0]!)).toEqual(rotated);
  });
});

describe('spaceManager.rotate', () => {
  it('changes the locks: new key + new room as epoch 1, history kept', async () => {
    seed([{ id: 's1', name: 'S', room: 'r0', key: 'k0', hub: 'ws://h' }]);
    const rotated = await spaceManager.rotate('s1');
    expect(rotated).not.toBeNull();

    const stored = spaceManager.list()[0]!;
    expect(stored.id).toBe('s1');
    expect(stored.name).toBe('S');
    expect(stored.hub).toBe('ws://h');
    expect(stored.current).toBe(1);
    expect(stored.key).not.toBe('k0');
    expect(stored.room).not.toBe('r0');
    // room/key mirror the current epoch, and epoch 0 survives for old data
    const kr = spaceKeyring(stored);
    expect(kr.current).toBe(1);
    expect(kr.epochs).toHaveLength(2);
    expect(kr.epochs[0]).toEqual({ epoch: 0, key: 'k0', room: 'r0' });
  });

  it('rotating an unknown space id returns null and stores nothing', async () => {
    expect(await spaceManager.rotate('nope')).toBeNull();
    expect(spaceManager.list()).toEqual([]);
  });
});

describe('spaceManager.activeTransport', () => {
  it('exposes the keyring and the room history (current room first)', async () => {
    seed([{ id: 's1', name: 'S', room: 'r0', key: 'k0', hub: 'ws://h' }]);
    await spaceManager.rotate('s1');
    spaceManager.setActive('s1');

    const t = spaceManager.activeTransport()!;
    const stored = spaceManager.list()[0]!;
    expect(t.room).toBe(stored.room);
    expect(t.keyring).toEqual(spaceKeyring(stored));
    expect(t.rooms).toEqual([stored.room, 'r0']);
  });
});

describe('spaceManager.join', () => {
  it('a v2 invite (with keyring) stores the full history', async () => {
    const rotated = await rotateKeyring(keyringFromLegacy('k0', 'r0'));
    const cur = rotated.epochs[1]!;
    spaceManager.join({
      name: 'J',
      room: cur.room,
      key: cur.key,
      hub: 'ws://h',
      keyring: rotated,
    });
    const stored = spaceManager.list()[0]!;
    expect(spaceKeyring(stored)).toEqual(rotated);
  });
});
