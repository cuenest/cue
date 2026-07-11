import { describe, it, expect } from 'vitest';
import { createEngine, slugify, titleFromSlug, parseNoteTokens, backlinks } from './index';

describe('note helpers', () => {
  it('slugify normalises titles', () => {
    expect(slugify('House Reno!')).toBe('house-reno');
    expect(slugify('  Weekly   Review  ')).toBe('weekly-review');
    expect(slugify('café/2026')).toBe('caf-2026');
  });

  it('titleFromSlug is a readable inverse', () => {
    expect(titleFromSlug('weekly-review')).toBe('Weekly review');
    expect(titleFromSlug('house-reno')).toBe('House reno');
  });

  it('parseNoteTokens extracts unique slugs from capture text', () => {
    expect(parseNoteTokens('call plumber #notes:house-reno and #notes:house-reno again')).toEqual([
      'house-reno',
    ]);
    expect(parseNoteTokens('#notes:a then #notes:b')).toEqual(['a', 'b']);
    expect(parseNoteTokens('no refs here')).toEqual([]);
  });
});

describe('note store', () => {
  it('creates, reads, updates and lists notes (newest-updated first)', async () => {
    const e = createEngine();
    const a = e.createNote({ title: 'Alpha', body: 'first' });
    expect(e.getNote(a.id)).toMatchObject({ title: 'Alpha', body: 'first' });

    await new Promise((r) => setTimeout(r, 3));
    const b = e.createNote({ title: 'Beta' });
    expect(e.getNotes().map((n) => n.id)).toEqual([b.id, a.id]); // b updated later

    await new Promise((r) => setTimeout(r, 3));
    e.updateNote(a.id, { body: 'edited' });
    expect(e.getNote(a.id)!.body).toBe('edited');
    expect(e.getNotes()[0]!.id).toBe(a.id); // a now most-recently updated
  });

  it('removes a note', () => {
    const e = createEngine();
    const n = e.createNote({ title: 'Temp' });
    e.removeNote(n.id);
    expect(e.getNote(n.id)).toBeUndefined();
    expect(e.getNotes()).toHaveLength(0);
  });

  it('links items to notes and resolves backlinks', () => {
    const e = createEngine();
    const note = e.createNote({ title: 'Project X' });
    const item = e.addItem('do a thing');
    e.setNoteRefs(item.id, [note.id]);

    const linked = e.getItems().find((i) => i.id === item.id)!;
    expect(linked.noteRefs).toEqual([note.id]);
    expect(backlinks(e.getItems(), note.id).map((i) => i.id)).toEqual([item.id]);
    expect(backlinks(e.getItems(), 'other')).toEqual([]);
  });

  it('notifies subscribers on note changes', () => {
    const e = createEngine();
    let hits = 0;
    const off = e.subscribeNotes(() => (hits += 1));
    e.createNote({ title: 'Ping' });
    expect(hits).toBeGreaterThan(0);
    off();
  });
});
