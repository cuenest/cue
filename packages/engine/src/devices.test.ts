import { describe, it, expect } from 'vitest';
import { createEngine, CueStore, isOnline, DEVICE_ONLINE_MS, type DeviceInfo } from './index';

const dev = (id: string, name: string, surface = 'web') => ({ id, name, surface });

describe('device registry', () => {
  it('registers a device and lists it', () => {
    const e = createEngine();
    e.registerDevice(dev('d1', 'Kent phone', 'mobile'));
    const list = e.getDevices();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'd1', name: 'Kent phone', surface: 'mobile' });
    expect(list[0]!.addedAt).toBeGreaterThan(0);
  });

  it('re-registering updates name + lastSeen but keeps addedAt', async () => {
    const e = createEngine();
    e.registerDevice(dev('d1', 'old name'));
    const first = e.getDevices()[0]!;
    await new Promise((r) => setTimeout(r, 5));
    e.registerDevice(dev('d1', 'new name'));
    const after = e.getDevices()[0]!;
    expect(after.name).toBe('new name');
    expect(after.addedAt).toBe(first.addedAt);
    expect(after.lastSeen).toBeGreaterThanOrEqual(first.lastSeen);
    expect(e.getDevices()).toHaveLength(1); // still one device, not a duplicate
  });

  it('touch refreshes lastSeen; no-op for unknown ids', () => {
    // CueStore exposes the `now` seam for deterministic time (the facade uses real time).
    const s = new CueStore();
    s.registerDevice(dev('d1', 'a'), 1000);
    s.touchDevice('d1', 5000);
    expect(s.getDevices()[0]!.lastSeen).toBe(5000);
    s.touchDevice('ghost', 9000); // does not throw or create
    expect(s.getDevices()).toHaveLength(1);
  });

  it('removes a device', () => {
    const e = createEngine();
    e.registerDevice(dev('d1', 'a'));
    e.registerDevice(dev('d2', 'b'));
    e.removeDevice('d1');
    expect(e.getDevices().map((d) => d.id)).toEqual(['d2']);
  });

  it('sorts by first-joined', () => {
    const s = new CueStore();
    s.registerDevice(dev('late', 'b'), 2000);
    s.registerDevice(dev('early', 'a'), 1000);
    expect(s.getDevices().map((d) => d.id)).toEqual(['early', 'late']);
  });

  it('isOnline reflects the heartbeat window', () => {
    const now = 100_000;
    const fresh: DeviceInfo = { id: 'x', name: 'x', surface: 'web', addedAt: 0, lastSeen: now - 1000 };
    const stale: DeviceInfo = { ...fresh, lastSeen: now - DEVICE_ONLINE_MS - 1 };
    expect(isOnline(fresh, now)).toBe(true);
    expect(isOnline(stale, now)).toBe(false);
  });

  it('notifies device subscribers on change', () => {
    const e = createEngine();
    let hits = 0;
    const off = e.subscribeDevices(() => (hits += 1));
    e.registerDevice(dev('d1', 'a'));
    expect(hits).toBeGreaterThan(0);
    off();
  });
});
