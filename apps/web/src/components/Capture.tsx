import { useState, type FormEvent } from 'react';
import { useEngine } from '../useEngine';

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
    <form onSubmit={submit}>
      <input
        aria-label="Capture"
        autoFocus
        placeholder="Capture anything…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  );
}
