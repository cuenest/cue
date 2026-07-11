import { parseNoteTokens, slugify, titleFromSlug, type CueEngine } from '@cue/engine';

/**
 * Resolve the #notes: tokens in a capture string to note ids, creating notes
 * that don't exist yet (matched case-insensitively by title slug). Returns the
 * unique note ids to store on the item's noteRefs.
 */
export function resolveNoteRefs(engine: CueEngine, text: string): string[] {
  const slugs = parseNoteTokens(text);
  if (slugs.length === 0) return [];
  const bySlug = new Map(engine.getNotes().map((n) => [slugify(n.title), n.id]));
  const ids: string[] = [];
  for (const slug of slugs) {
    let id = bySlug.get(slug);
    if (!id) {
      id = engine.createNote({ title: titleFromSlug(slug) }).id;
      bySlug.set(slug, id);
    }
    ids.push(id);
  }
  return [...new Set(ids)];
}
