import type { CueEngine } from '@cue/engine';
import { resolveNoteRefs } from '../notes/resolve';
import { parseDue } from './dueDate';

/** Example date expressions offered in the #due: autocomplete. */
export const DUE_EXAMPLES = ['today', 'tonight', 'tomorrow', 'next week'];

/**
 * Apply the #-commands found in a capture string, then create the item:
 *   #notes:<slug>  → link a note (chip); token kept in the body
 *   #due:<when>    → schedule + remind (parsed); token stripped
 *   #to:<who>      → delegate; token stripped
 * Returns the created item id, or null if nothing meaningful was captured.
 */
export function runCapture(engine: CueEngine, raw: string): string | null {
  const noteRefs = resolveNoteRefs(engine, raw); // uses the #notes: tokens (kept in body)

  let body = raw;

  // #due:<expr> — strip only if it parses to a real date
  let dueAt: number | null = null;
  const dueM = /#due:([^#]*?)(?=\s#|$)/i.exec(raw);
  if (dueM) {
    const parsed = parseDue(dueM[1]!.trim());
    if (parsed != null) {
      dueAt = parsed;
      body = body.replace(dueM[0], '');
    }
  }

  // #to:<who> — a single token (no spaces)
  let delegatee: string | null = null;
  const toM = /#to:(\S+)/i.exec(raw);
  if (toM) {
    delegatee = toM[1]!;
    body = body.replace(toM[0], '');
  }

  body = body.replace(/\s+/g, ' ').trim();
  if (!body) return null;

  const item = engine.addItem(body);
  if (noteRefs.length) engine.setNoteRefs(item.id, noteRefs);
  if (delegatee) engine.delegate(item.id, delegatee);
  else if (dueAt != null) engine.schedule(item.id, dueAt);
  return item.id;
}
