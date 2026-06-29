export type ItemId = string;

export type ItemStatus = 'inbox' | 'scheduled' | 'done' | 'dropped' | 'delegated';

export interface Item {
  id: ItemId;
  body: string;
  createdAt: number;
  status: ItemStatus;
  order: number;
  dueAt?: number;
  delegatedTo?: string;
  updatedAt: number;
}
