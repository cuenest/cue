import { useEngine } from '../useEngine';
import { openNote } from '../router';

/** Small chips for the notes an item links to; tap opens the note. */
export function NoteChips({ noteRefs }: { noteRefs?: string[] }) {
  const engine = useEngine();
  if (!noteRefs || noteRefs.length === 0) return null;
  const notes = noteRefs.map((id) => engine.getNote(id)).filter((n): n is NonNullable<typeof n> => !!n);
  if (notes.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {notes.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openNote(n.id);
          }}
          className="inline-flex items-center gap-1 border border-border bg-accent/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          title={`Open note: ${n.title}`}
        >
          <span aria-hidden="true">#</span>
          <span className="max-w-[12rem] truncate">{n.title}</span>
        </button>
      ))}
    </div>
  );
}
