import { useRef, useState } from 'react';
import { assembleFile, type FileManifest } from '@cue/engine';
import { Panel } from '../components/Panel';
import { Button } from '../components/ui/button';
import { useEngine, useItems } from '../useEngine';
import { navigate } from '../router';
import { spaceManager } from '../spaces/manager';
import { hubBlobIO, hashFileChunks, uploadFileChunks } from '../files/transfer';
import { previewKind, preparePreview, type PreviewKind } from '../files/preview';
import { cn } from '../lib/utils';
import { timeAgo } from '../lib/time';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FilesView() {
  const engine = useEngine();
  const items = useItems(); // invalidates on any engine change, incl. file manifests
  void items;
  const files = engine.getFileManifests();
  const transport = spaceManager.activeTransport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ id: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; kind: PreviewKind; name: string } | null>(
    null,
  );

  // no hub for the active space → can't move bytes
  if (!transport) {
    return (
      <Panel delay={60}>
        <div className="px-5 py-5 pb-8 sm:px-6">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">04</span>
            <span>Files</span>
          </div>
          <div className="flex flex-col items-center gap-3 border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              File transfer needs a hub. Set up sync for your personal space, or switch to a shared
              space — files then upload to the hub and appear on every linked device.
            </p>
            <Button variant="outline" onClick={() => navigate('settings')}>
              Open settings
            </Button>
          </div>
        </div>
      </Panel>
    );
  }

  const io = hubBlobIO(transport.hub, transport.room);
  const key = transport.key;

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      // hash one slice at a time (never loads the whole file into memory)
      const chunkHashes = await hashFileChunks(file);
      const manifest: FileManifest = {
        id: crypto.randomUUID(),
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        chunkHashes,
        hubComplete: false,
        addedAt: Date.now(),
      };
      // sync-first: the file is visible on every device immediately (as "uploading")
      engine.addFileManifest(manifest);
      setProgress({ id: manifest.id, pct: 0 });
      await uploadFileChunks(file, chunkHashes, key, io, (done, total) =>
        setProgress({ id: manifest.id, pct: Math.round((done / total) * 100) }),
      );
      engine.setHubComplete(manifest.id, true); // flips everyone's status to "available"
    } catch (e) {
      setError(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function download(m: FileManifest) {
    setError(null);
    try {
      const bytes = await assembleFile(m, key, io); // fetch + decrypt + verify chunks
      const blob = new Blob([bytes as BlobPart], { type: m.mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = m.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError('Could not download — the file may not be on the hub yet, or the hub is offline.');
    }
  }

  async function openPreview(m: FileManifest) {
    setError(null);
    const kind = previewKind(m.mime);
    if (!kind || !transport) return;
    try {
      const url = await preparePreview(m, transport);
      setPreview({ url, kind, name: m.name });
    } catch {
      setError('Could not open a preview — the hub may be offline.');
    }
  }

  function statusLabel(m: FileManifest): string {
    if (progress && progress.id === m.id) return `uploading ${progress.pct}%`;
    return m.hubComplete ? 'available' : 'on this device only';
  }

  return (
    <Panel delay={60}>
      <div className="px-5 py-5 pb-8 sm:px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">04</span>
            <span>Files</span>
          </div>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
            end-to-end encrypted · streamed from the hub · any size
          </span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer">
            <span className="inline-flex h-9 items-center rounded-[2px] border border-border-strong bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[2px_2px_0_0_var(--color-border-strong)] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_var(--color-border-strong)]">
              {progress ? `Uploading ${progress.pct}%` : 'Add file'}
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
            chunked, encrypted, uploaded to the hub — bytes sync on demand, not to every device
          </span>
        </div>
        {error && (
          <p className="mb-3 border border-border-strong bg-primary/20 px-3 py-2 text-xs">{error}</p>
        )}

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
                  'flex flex-wrap items-center gap-3 px-4 py-3',
                  idx > 0 && 'border-t border-border',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                <span
                  className={cn(
                    'shrink-0 font-mono text-[10px] uppercase tracking-widest',
                    f.hubComplete
                      ? 'text-muted-foreground'
                      : 'bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground',
                  )}
                >
                  {statusLabel(f)}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {fmtSize(f.size)} · {timeAgo(f.addedAt)}
                </span>
                {previewKind(f.mime) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!f.hubComplete}
                    onClick={() => void openPreview(f)}
                  >
                    Preview
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!f.hubComplete}
                  onClick={() => void download(f)}
                >
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

      {preview && (
        <div
          role="dialog"
          aria-label={`Preview ${preview.name}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col border border-border-strong bg-card shadow-[var(--stack)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="truncate font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {preview.name} · streaming from hub
              </span>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                close ✕
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background p-2">
              {preview.kind === 'image' && (
                <img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" />
              )}
              {preview.kind === 'video' && (
                <video src={preview.url} controls autoPlay className="max-h-full max-w-full" />
              )}
              {preview.kind === 'audio' && <audio src={preview.url} controls autoPlay className="w-full" />}
              {preview.kind === 'pdf' && (
                <iframe src={preview.url} title={preview.name} className="h-[75vh] w-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
