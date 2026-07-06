import { useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/ui/button';
import { useEngine, useItems } from '../useEngine';
import { cn } from '../lib/utils';
import { timeAgo } from '../lib/time';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // MVP cap — files replicate to every device in the space

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesView() {
  const engine = useEngine();
  const items = useItems(); // invalidates on any engine change, incl. files
  void items;
  const files = engine.getFiles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(`Too big — the MVP cap is ${fmtSize(MAX_FILE_BYTES)} per file.`);
      return;
    }
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) {
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      }
      engine.addFile({
        name: file.name,
        mime: file.type || 'application/octet-stream',
        dataB64: btoa(bin),
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function download(id: string) {
    const f = engine.getFiles().find((x) => x.id === id);
    if (!f) return;
    const bin = atob(f.dataB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: f.mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Panel delay={60}>
      <div className="px-5 py-5 pb-8 sm:px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">
              04
            </span>
            <span>Files</span>
          </div>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
            end-to-end encrypted · synced with this space
          </span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer">
            <span className="inline-flex h-9 items-center rounded-[2px] border border-border-strong bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[2px_2px_0_0_var(--color-border-strong)] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_var(--color-border-strong)]">
              {busy ? 'Adding…' : 'Add file'}
            </span>
            <input
              ref={inputRef}
              type="file"
              aria-label="Add file"
              className="hidden"
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
          </label>
          <span className="font-mono text-[11px] text-muted-foreground">
            up to {fmtSize(MAX_FILE_BYTES)} — stored inside the encrypted space, on every linked
            device
          </span>
        </div>
        {error && <p className="mb-3 border border-border-strong bg-primary/20 px-3 py-2 text-xs">{error}</p>}

        {files.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center font-mono text-xs text-muted-foreground">
            no files in this space yet — add one and it appears on every device that shares it
          </p>
        ) : (
          <ul className="border border-border-strong bg-card shadow-[var(--stack-sm)]">
            {files.map((f, idx) => (
              <li
                key={f.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  idx > 0 && 'border-t border-border',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {fmtSize(f.size)} · {timeAgo(f.addedAt)}
                </span>
                <Button size="sm" variant="outline" onClick={() => download(f.id)}>
                  Download
                </Button>
                <Button size="sm" variant="ghost" onClick={() => engine.removeFile(f.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
