import type { Item } from './types';

/**
 * Notes are persistent reference material (distinct from queue tasks). They sync
 * in the CRDT doc like everything else. Items link to notes via #notes:<slug>
 * tokens in their body; the resolved note ids are stored on the item (noteRefs),
 * and a note's "linked items" are the items whose noteRefs include it.
 */
export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

/** Title → reference slug (the form used inside #notes: tokens). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Human title from a slug, for inline-created notes (e.g. "weekly-review" → "Weekly review"). */
export function titleFromSlug(slug: string): string {
  const s = slug.replace(/-+/g, ' ').trim();
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

const TOKEN = /#notes:([a-z0-9][a-z0-9-]*)/gi;

/** Extract the unique note slugs referenced in a capture string. */
export function parseNoteTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN)) out.push(m[1]!.toLowerCase());
  return [...new Set(out)];
}

/** Items that reference a given note (the note's backlinks). */
export function backlinks(items: Item[], noteId: string): Item[] {
  return items.filter((i) => i.noteRefs?.includes(noteId));
}
