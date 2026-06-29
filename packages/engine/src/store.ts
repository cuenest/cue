import * as Y from 'yjs';
import type { Item, ItemId, ItemStatus } from './types';

const ITEMS_KEY = 'items';

export class CueStore {
  readonly doc: Y.Doc;
  private readonly items: Y.Map<Y.Map<unknown>>;

  constructor(doc: Y.Doc = new Y.Doc()) {
    this.doc = doc;
    this.items = doc.getMap(ITEMS_KEY);
  }

  addItem(body: string, now: number = Date.now()): Item {
    const id = crypto.randomUUID();
    this.doc.transact(() => {
      const ymap = new Y.Map<unknown>();
      ymap.set('id', id);
      ymap.set('body', body);
      ymap.set('createdAt', now);
      ymap.set('status', 'inbox' satisfies ItemStatus);
      ymap.set('order', now);
      ymap.set('updatedAt', now);
      this.items.set(id, ymap);
    });
    return this.getItem(id)!;
  }

  getItem(id: ItemId): Item | undefined {
    const ymap = this.items.get(id);
    return ymap ? toItem(ymap) : undefined;
  }

  getAllItems(): Item[] {
    const out: Item[] = [];
    this.items.forEach((ymap) => out.push(toItem(ymap)));
    return out;
  }

  updateItem(
    id: ItemId,
    patch: Partial<Omit<Item, 'id' | 'createdAt'>>,
    now: number = Date.now(),
  ): Item {
    const ymap = this.items.get(id);
    if (!ymap) throw new Error(`Item not found: ${id}`);
    this.doc.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) ymap.set(key, value);
      }
      ymap.set('updatedAt', now);
    });
    return toItem(ymap);
  }

  subscribe(listener: () => void): () => void {
    const handler = () => listener();
    this.items.observeDeep(handler);
    return () => this.items.unobserveDeep(handler);
  }
}

function toItem(y: Y.Map<unknown>): Item {
  return {
    id: y.get('id') as string,
    body: y.get('body') as string,
    createdAt: y.get('createdAt') as number,
    status: y.get('status') as ItemStatus,
    order: y.get('order') as number,
    dueAt: y.get('dueAt') as number | undefined,
    delegatedTo: y.get('delegatedTo') as string | undefined,
    updatedAt: y.get('updatedAt') as number,
  };
}
