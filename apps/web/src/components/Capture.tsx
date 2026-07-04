import { useState, type FormEvent } from 'react';
import { useEngine } from '../useEngine';
import { Input } from './ui/input';

export function Capture() {
  const engine = useEngine();
  const [text, setText] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    engine.addItem(body);
    setText('');
  }

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">01</span>
        <span>Capture</span>
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-3 border border-border-strong bg-card px-4 shadow-[var(--stack-sm)] transition-[transform,box-shadow] duration-150 focus-within:translate-x-[2px] focus-within:translate-y-[2px] focus-within:shadow-none"
      >
        <Input
          aria-label="Capture"
          autoFocus
          placeholder="Capture anything — a thought, a task, a name, a number…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <kbd className="hidden shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
          enter
        </kbd>
      </form>
    </div>
  );
}
