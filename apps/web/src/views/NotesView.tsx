import { useEffect, useState } from 'react';
import { backlinks, type Note } from '@cue/engine';
import { Panel } from '../components/Panel';
import { Button } from '../components/ui/button';
import { useEngine, useItems } from '../useEngine';
import { navigate, noteIdFromHash } from '../router';
import { Markdown } from '../notes/MarkdownView';
import { cn } from '../lib/utils';
import { timeAgo } from '../lib/time';

function firstLine(body: string): string {
  const line = body.split('\n').find((l) => l.trim()) ?? '';
  return line.replace(/^#+\s*/, '').slice(0, 80);
}

function NoteEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const engine = useEngine();
  const items = useItems();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [mode, setMode] = useState<'write' | 'preview'>(note.body ? 'preview' : 'write');

  const linked = backlinks(items, note.id);

  function persist(next: { title?: string; body?: string }) {
    engine.updateNote(note.id, next);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          ← Notes
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === 'write' ? 'default' : 'ghost'}
            onClick={() => setMode('write')}
          >
            Write
          </Button>
          <Button
            size="sm"
            variant={mode === 'preview' ? 'default' : 'ghost'}
            onClick={() => setMode('preview')}
          >
            Preview
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete “${note.title}”?`)) {
                engine.removeNote(note.id);
                onBack();
              }
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      <input
        aria-label="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => persist({ title: title.trim() || 'Untitled' })}
        placeholder="Note title"
        className="mb-3 w-full border-b border-border bg-transparent pb-2 font-sans text-xl font-bold tracking-tight outline-none focus:border-border-strong"
      />

      {mode === 'write' ? (
        <textarea
          aria-label="Note body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => persist({ body })}
          placeholder={'Write anything — markdown works.\n\n# Heading\n- a list\n**bold**, [links](https://…), ![images](https://…)'}
          className="min-h-64 w-full resize-y border border-border bg-card p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-border-strong"
        />
      ) : (
        <div
          className="min-h-64 border border-border bg-card p-4 text-sm"
          onClick={() => setMode('write')}
          title="Click to edit"
        >
          <Markdown body={body} />
        </div>
      )}

      {linked.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Linked items ({linked.length})
          </div>
          <ul className="border border-border-strong bg-card shadow-[var(--stack-sm)]">
            {linked.map((it, i) => (
              <li
                key={it.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm',
                  i > 0 && 'border-t border-border',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{it.body}</span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {it.status}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('queue')}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                >
                  open →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function NotesView() {
  const engine = useEngine();
  useItems(); // re-render on note/item changes
  const notes = engine.getNotes();
  const [selectedId, setSelectedId] = useState<string | null>(() => noteIdFromHash());
  const selected = selectedId ? engine.getNote(selectedId) : null;

  // a chip elsewhere can deep-link to a note via #/notes/<id>
  useEffect(() => {
    const onHash = () => {
      const id = noteIdFromHash();
      if (id) setSelectedId(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function newNote() {
    const n = engine.createNote({ title: 'Untitled' });
    setSelectedId(n.id);
  }

  return (
    <Panel delay={60}>
      <div className="px-5 py-5 pb-8 sm:px-6">
        {selected ? (
          <NoteEditor note={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">
                  05
                </span>
                <span>Notes</span>
              </div>
              <Button size="sm" onClick={newNote}>
                New note
              </Button>
            </div>

            {notes.length === 0 ? (
              <p className="border border-dashed border-border px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                no notes yet — reference them from capture with{' '}
                <span className="text-foreground">#notes:</span>, or make one here
              </p>
            ) : (
              <ul className="border border-border-strong bg-card shadow-[var(--stack-sm)]">
                {notes.map((n, i) => (
                  <li key={n.id} className={cn(i > 0 && 'border-t border-border')}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(n.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{n.title}</span>
                        {firstLine(n.body) && (
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {firstLine(n.body)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {timeAgo(n.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
