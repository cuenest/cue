import { describe, it, expect, vi } from 'vitest';
import { createEngine } from './index';

describe('createEngine', () => {
  it('addItem then getInbox/getNext reflect it', () => {
    const engine = createEngine();
    engine.addItem('a');
    expect(engine.getInbox()).toHaveLength(1);
    expect(engine.getNext()?.body).toBe('a');
  });

  it('getItems returns a stable reference until data changes', () => {
    const engine = createEngine();
    const first = engine.getItems();
    expect(engine.getItems()).toBe(first); // same ref, no change
    engine.addItem('a');
    expect(engine.getItems()).not.toBe(first); // changed ref after mutation
  });

  it('subscribe is notified on change', () => {
    const engine = createEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.addItem('a');
    expect(listener).toHaveBeenCalled();
  });
});

describe('process actions', () => {
  it('complete marks status done and removes it from inbox', () => {
    const engine = createEngine();
    const item = engine.addItem('a');
    engine.complete(item.id);
    expect(engine.getInbox()).toHaveLength(0);
    expect(engine.getItems().find((i) => i.id === item.id)?.status).toBe('done');
  });

  it('schedule sets status scheduled and dueAt', () => {
    const engine = createEngine();
    const item = engine.addItem('a');
    const updated = engine.schedule(item.id, 12345);
    expect(updated.status).toBe('scheduled');
    expect(updated.dueAt).toBe(12345);
  });

  it('delegate sets status delegated and delegatedTo', () => {
    const engine = createEngine();
    const item = engine.addItem('a');
    const updated = engine.delegate(item.id, 'Sam');
    expect(updated.status).toBe('delegated');
    expect(updated.delegatedTo).toBe('Sam');
  });

  it('drop sets status dropped', () => {
    const engine = createEngine();
    const item = engine.addItem('a');
    expect(engine.drop(item.id).status).toBe('dropped');
  });

  it('bump moves an item to the front of the queue', () => {
    const engine = createEngine();
    engine.addItem('first');
    const second = engine.addItem('second');
    engine.bump(second.id);
    expect(engine.getNext()?.id).toBe(second.id);
  });
});

describe('requeue, edit, undo', () => {
  it('requeue returns a processed item to the front of the queue', () => {
    const engine = createEngine();
    engine.addItem('a');
    const b = engine.addItem('b');
    engine.complete(b.id);
    engine.requeue(b.id);
    expect(engine.getNext()?.id).toBe(b.id);
    expect(engine.getInbox()).toHaveLength(2);
  });

  it('edit updates the body and keeps status', () => {
    const engine = createEngine();
    const item = engine.addItem('typo');
    const updated = engine.edit(item.id, 'fixed');
    expect(updated.body).toBe('fixed');
    expect(updated.status).toBe('inbox');
  });

  it('undo reverts the most recent action', () => {
    const engine = createEngine();
    const item = engine.addItem('a');
    engine.complete(item.id);
    engine.undo();
    expect(engine.getItems().find((i) => i.id === item.id)?.status).toBe('inbox');
  });

  it('undo with nothing to undo is a no-op', () => {
    const engine = createEngine();
    expect(() => engine.undo()).not.toThrow();
  });
});

describe('file manifests', () => {
  const manifest = {
    id: 'f1',
    name: 'note.txt',
    mime: 'text/plain',
    size: 5,
    chunkHashes: ['h1'],
    hubComplete: false,
    addedAt: 1,
  };

  it('add/get/setHubComplete/remove round-trip', () => {
    const engine = createEngine();
    engine.addFileManifest(manifest);
    let listed = engine.getFileManifests();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.name).toBe('note.txt');
    expect(listed[0]!.hubComplete).toBe(false);
    expect(listed[0]!.chunkHashes).toEqual(['h1']);

    engine.setHubComplete('f1', true);
    expect(engine.getFileManifests()[0]!.hubComplete).toBe(true);

    engine.removeFile('f1');
    expect(engine.getFileManifests()).toHaveLength(0);
  });

  it('file changes notify subscribers', () => {
    const engine = createEngine();
    let called = 0;
    engine.subscribe(() => {
      called += 1;
    });
    engine.addFileManifest(manifest);
    expect(called).toBeGreaterThan(0);
  });
});
