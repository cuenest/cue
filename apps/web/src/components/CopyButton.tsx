import { useState } from 'react';
import { Button } from './ui/button';
import { copyText } from '../lib/clipboard';

/** A Copy button that actually reports whether the copy succeeded. */
export function CopyButton({
  text,
  label = 'Copy',
  size = 'sm',
  variant = 'outline',
}: {
  text: string;
  label?: string;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline' | 'ghost';
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  async function onCopy() {
    const ok = await copyText(text);
    setState(ok ? 'ok' : 'fail');
    setTimeout(() => setState('idle'), 1500);
  }

  return (
    <Button size={size} variant={variant} onClick={() => void onCopy()}>
      {state === 'ok' ? 'Copied ✓' : state === 'fail' ? 'Copy failed' : label}
    </Button>
  );
}
