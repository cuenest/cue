import { useEffect, useRef, useState } from 'react';
import { spaceManager, useActiveSpace, PERSONAL_SPACE } from '../spaces/manager';
import { cn } from '../lib/utils';

/**
 * Custom dropdown (not a native <select>) so the open menu can carry the paper
 * theme — the native popup is OS-rendered and unstylable on Windows Chrome.
 */
export function SpaceSwitcher() {
  const { spaceId, spaces } = useActiveSpace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (spaces.length === 0) return null;

  const inShared = spaceId !== PERSONAL_SPACE;
  const currentName = inShared ? (spaces.find((s) => s.id === spaceId)?.name ?? 'space') : 'personal';

  const options: Array<{ id: string; label: string }> = [
    { id: PERSONAL_SPACE, label: 'personal' },
    ...spaces.map((s) => ({ id: s.id, label: s.name })),
  ];

  function choose(id: string) {
    spaceManager.setActive(id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Space"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex max-w-36 items-center gap-1.5 rounded-[2px] border py-1 pl-2 pr-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors',
          inShared
            ? 'border-border-strong bg-primary font-semibold text-primary-foreground shadow-[2px_2px_0_0_var(--color-border-strong)]'
            : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
        )}
      >
        <span className="truncate">{currentName}</span>
        <span aria-hidden="true" className="text-[8px] leading-none">
          ▼
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-40 border border-border-strong bg-card py-1 shadow-[var(--stack-sm)]"
        >
          {options.map((o) => {
            const active = o.id === spaceId;
            return (
              <li key={o.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => choose(o.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.1em] transition-colors',
                    active
                      ? 'bg-accent font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full',
                      active ? 'bg-primary ring-1 ring-border-strong' : 'bg-transparent',
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
