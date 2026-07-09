import { describe, it, expect, vi } from 'vitest';
import { HubController, type HubFactory, type HubLike } from './hub-controller';

function fakeFactory() {
  const close = vi.fn(async () => {});
  const createHub: HubFactory = vi.fn(async (opts) => ({ port: opts.port ?? 4444, close }) as HubLike);
  return { createHub, close };
}

describe('HubController', () => {
  it('starts the hub and reports it running with a port', async () => {
    const { createHub } = fakeFactory();
    const c = new HubController({ dataDir: '/data', port: 4444, loadFactory: async () => createHub });
    expect(c.running).toBe(false);
    const port = await c.start();
    expect(port).toBe(4444);
    expect(c.running).toBe(true);
    expect(c.port).toBe(4444);
    expect(createHub).toHaveBeenCalledWith({ port: 4444, dataDir: '/data' });
  });

  it('is idempotent — a second start does not spawn another hub', async () => {
    const { createHub } = fakeFactory();
    const c = new HubController({ dataDir: '/data', loadFactory: async () => createHub });
    await c.start();
    await c.start();
    expect(createHub).toHaveBeenCalledTimes(1);
  });

  it('concurrent starts share a single hub', async () => {
    const { createHub } = fakeFactory();
    const c = new HubController({ dataDir: '/data', loadFactory: async () => createHub });
    await Promise.all([c.start(), c.start(), c.start()]);
    expect(createHub).toHaveBeenCalledTimes(1);
  });

  it('stops the hub and clears running state', async () => {
    const { createHub, close } = fakeFactory();
    const c = new HubController({ dataDir: '/data', loadFactory: async () => createHub });
    await c.start();
    await c.stop();
    expect(close).toHaveBeenCalledOnce();
    expect(c.running).toBe(false);
    expect(c.port).toBeNull();
  });

  it('can restart after stopping', async () => {
    const { createHub } = fakeFactory();
    const c = new HubController({ dataDir: '/data', loadFactory: async () => createHub });
    await c.start();
    await c.stop();
    await c.start();
    expect(createHub).toHaveBeenCalledTimes(2);
    expect(c.running).toBe(true);
  });
});
