import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { slugify, titleFromSlug, type Note } from '@cue/engine';
import { useEngine, useItems } from '../useEngine';
import { resolveNoteRefs } from '../notes/resolve';
import { cn } from '../lib/utils';

interface Command {
  id: string;
  label: string;
  hint: string;
  insert: string; // what typing the command expands to
}

/** Slash-style commands triggered by typing "#". Extend this list to add more. */
const COMMANDS: Command[] = [{ id: 'notes', label: 'notes', hint: 'link a note', insert: '#notes:' }];

type Suggestion =
  | { kind: 'command'; cmd: Command }
  | { kind: 'note'; note: Note }
  | { kind: 'create'; slug: string };

const NOTE_TOKEN = /#notes:([a-zA-Z0-9-]*)$/; // #notes:<query> at the caret
const CMD_TOKEN = /#([a-zA-Z]*)$/; // # or #<partial-command> at the caret

export function Capture() {
  const engine = useEngine();
  useItems(); // re-render as notes/items change so suggestions stay fresh
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const pendingCaret = useRef<number | null>(null);

  // apply a programmatic caret position after we rewrite the text
  useEffect(() => {
    if (pendingCaret.current != null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  const before = text.slice(0, caret);
  // note mode (#notes:<query>) takes priority; otherwise command mode (#<partial>)
  const noteMatch = open ? NOTE_TOKEN.exec(before) : null;
  const cmdMatch = open && !noteMatch ? CMD_TOKEN.exec(before) : null;
  const match = noteMatch ?? cmdMatch;

  let suggestions: Suggestion[] = [];
  if (noteMatch) {
    const query = noteMatch[1]!.toLowerCase();
    const notes = engine.getNotes();
    const filtered = notes
      .filter((n) => !query || slugify(n.title).includes(query) || n.title.toLowerCase().includes(query))
      .slice(0, 6)
      .map((n): Suggestion => ({ kind: 'note', note: n }));
    const exact = notes.some((n) => slugify(n.title) === query);
    suggestions = query && !exact ? [...filtered, { kind: 'create', slug: query }] : filtered;
  } else if (cmdMatch) {
    const partial = cmdMatch[1]!.toLowerCase();
    suggestions = COMMANDS.filter((c) => c.label.startsWith(partial)).map((c): Suggestion => ({
      kind: 'command',
      cmd: c,
    }));
  }
  const showMenu = !!match && suggestions.length > 0;

  // Position the dropdown (portaled to <body>) under the input box, tracking
  // scroll/resize. Portaling escapes the section panels' stacking + the
  // dividers below, so the menu always floats cleanly above the page.
  useEffect(() => {
    if (!showMenu) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const r = boxRef.current?.getBoundingClientRect();
      if (r) setMenuPos({ left: r.left, top: r.bottom + 4, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showMenu, text, caret]);

  function syncCaret() {
    setCaret(inputRef.current?.selectionStart ?? text.length);
  }

  function choose(s: Suggestion) {
    if (!match) return;
    const tokenStart = (match.index ?? 0) as number;
    // command → expand it (e.g. "#no" → "#notes:") and keep the menu open so the
    // next-level suggestions (the notes) appear immediately.
    const replacement =
      s.kind === 'command'
        ? s.cmd.insert
        : `#notes:${s.kind === 'note' ? slugify(s.note.title) : s.slug} `;
    const next = text.slice(0, tokenStart) + replacement + text.slice(caret);
    pendingCaret.current = tokenStart + replacement.length;
    setText(next);
    setCaret(pendingCaret.current);
    setHighlight(0);
    setOpen(s.kind === 'command'); // stay open after a command, close after a note pick
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showMenu) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      choose(suggestions[Math.min(highlight, suggestions.length - 1)]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const item = engine.addItem(body);
    const refs = resolveNoteRefs(engine, body);
    if (refs.length) engine.setNoteRefs(item.id, refs);
    setText('');
    setOpen(false);
  }

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">01</span>
        <span>Capture</span>
      </div>

      <form onSubmit={submit} className="relative">
        <div
          ref={boxRef}
          className="flex items-center gap-3 border border-border-strong bg-card px-4 shadow-[var(--stack-sm)] transition-[transform,box-shadow] duration-150 focus-within:translate-x-[2px] focus-within:translate-y-[2px] focus-within:shadow-none"
        >
          <input
            ref={inputRef}
            aria-label="Capture"
            autoFocus
            placeholder="Capture anything — type # for commands"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              setOpen(true);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            onKeyUp={syncCaret}
            onClick={syncCaret}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="h-11 w-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
            enter
          </kbd>
        </div>

        {showMenu &&
          menuPos &&
          createPortal(
            <ul
              className="fixed z-[80] max-h-64 overflow-auto border border-border-strong bg-card shadow-[var(--stack)]"
              style={{ left: menuPos.left, top: menuPos.top, width: menuPos.width }}
            >
              {suggestions.map((s, i) => (
              <li
                key={
                  s.kind === 'command'
                    ? `cmd-${s.cmd.id}`
                    : s.kind === 'note'
                      ? s.note.id
                      : `create-${s.slug}`
                }
              >
                <button
                  type="button"
                  // onMouseDown (not onClick) so it fires before the input's blur
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    i === highlight ? 'bg-accent' : 'hover:bg-accent/50',
                  )}
                >
                  {s.kind === 'command' ? (
                    <>
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        #{s.cmd.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {s.cmd.hint}
                      </span>
                    </>
                  ) : s.kind === 'note' ? (
                    <>
                      <span className="font-mono text-[11px] text-muted-foreground">#</span>
                      <span className="min-w-0 flex-1 truncate">{s.note.title}</span>
                    </>
                  ) : (
                    <>
                      <span className="bg-primary px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-primary-foreground">
                        new
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        Create note “{titleFromSlug(s.slug)}”
                      </span>
                    </>
                  )}
                </button>
              </li>
              ))}
            </ul>,
            document.body,
          )}
      </form>
    </div>
  );
}
