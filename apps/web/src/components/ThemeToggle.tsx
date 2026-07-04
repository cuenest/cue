import { useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  function toggle() {
    const el = document.documentElement;
    const next = !el.classList.contains('dark');
    el.classList.toggle('dark', next);
    try {
      localStorage.setItem('cue-theme', next ? 'dark' : 'light');
    } catch {
      /* private mode — theme just won't persist */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      title="Toggle theme"
      className="rounded-[2px] border border-border bg-transparent px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
    >
      {dark ? 'light' : 'dark'}
    </button>
  );
}
