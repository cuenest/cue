import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { generateSyncKey, makeLinkCode, parseLinkCode } from '@cue/engine';
import { Panel } from '../components/Panel';
import { useEngine, useItems } from '../useEngine';
import { syncManager, useSyncStatus, DEFAULT_HUB, type SyncConfig } from '../sync/manager';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

const PALETTE = ['#4a90d9', '#4fa96b', '#c95d63', '#9a6fb8', '#d98a3d', '#5aa7a7'];

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
      <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">
        {index}
      </span>
      <span>{title}</span>
    </div>
  );
}

function SyncSection() {
  const status = useSyncStatus();
  const [config, setConfig] = useState<SyncConfig | null>(() => syncManager.getConfig());
  const [hub, setHub] = useState(config?.hub ?? DEFAULT_HUB);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const linkCode = config ? makeLinkCode({ room: config.room, key: config.key, hub: config.hub }) : null;

  useEffect(() => {
    if (showCode && linkCode) {
      QRCode.toDataURL(linkCode, { margin: 1, width: 220 })
        .then(setQr)
        .catch(() => setQr(null));
    } else {
      setQr(null);
    }
  }, [showCode, linkCode]);

  async function createSpace() {
    setError(null);
    const cfg: SyncConfig = {
      room: crypto.randomUUID(),
      key: await generateSyncKey(),
      hub: hub.trim() || DEFAULT_HUB,
    };
    syncManager.configure(cfg);
    setConfig(cfg);
  }

  function joinSpace(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseLinkCode(joinCode.trim());
    if (!parsed) {
      setError('That code is not valid.');
      return;
    }
    const cfg: SyncConfig = {
      room: parsed.room,
      key: parsed.key,
      hub: parsed.hub ?? hub.trim() ?? DEFAULT_HUB,
    };
    syncManager.configure(cfg);
    setConfig(cfg);
    setJoinCode('');
  }

  function leave() {
    syncManager.configure(null);
    setConfig(null);
    setShowCode(false);
  }

  return (
    <div>
      <SectionHeader index="01" title="Sync" />
      <div className="border border-border-strong bg-card p-4 shadow-[var(--stack-sm)]">
        {!config ? (
          <>
            <p className="text-sm text-muted-foreground">
              Sync is off. Your data lives only on this device. Create a sync space to link other
              devices, or join one with a link code. All traffic is end-to-end encrypted — the hub
              only ever relays ciphertext.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                hub
              </label>
              <input
                aria-label="Hub URL"
                value={hub}
                onChange={(e) => setHub(e.target.value)}
                placeholder={DEFAULT_HUB}
                className="h-9 min-w-56 flex-1 rounded-[2px] border border-border bg-transparent px-2 font-mono text-xs outline-none focus:border-border-strong"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void createSpace()}>Create sync space</Button>
            </div>
            <form onSubmit={joinSpace} className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              <input
                aria-label="Link code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="paste a link code (cue1.…)"
                className="h-9 min-w-56 flex-1 rounded-[2px] border border-border bg-transparent px-2 font-mono text-xs outline-none focus:border-border-strong"
              />
              <Button type="submit" variant="outline">
                Join
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest',
                  status === 'connected'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground',
                )}
              >
                {status}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                room {config.room.slice(0, 8)}… · hub {config.hub}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowCode((v) => !v)}>
                {showCode ? 'Hide link code' : 'Link a device'}
              </Button>
              <Button variant="ghost" onClick={leave}>
                Leave sync space
              </Button>
            </div>
            {showCode && linkCode && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 font-mono text-[11px] text-muted-foreground">
                  scan on the other device, or paste the code there — anyone with this code can
                  read this space
                </p>
                {qr && <img src={qr} alt="Link QR code" className="border border-border-strong" />}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="max-w-full overflow-x-auto whitespace-nowrap border border-border bg-background px-2 py-1 font-mono text-[10px]">
                    {linkCode}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void navigator.clipboard?.writeText(linkCode)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        {error && <p className="mt-2 font-mono text-xs text-muted-foreground">{error}</p>}
      </div>
    </div>
  );
}

function CalendarsSection() {
  const engine = useEngine();
  const items = useItems(); // re-render on source changes
  void items;
  const sources = engine.getSources();

  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]!);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFromText(icsText: string, sourceUrl?: string) {
    engine.addSource({
      name: name.trim() || 'Calendar',
      color,
      icsText,
      url: sourceUrl,
    });
    setName('');
    setUrl('');
    setError(null);
  }

  async function fetchUrl() {
    setError(null);
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(url.trim());
      if (!res.ok) throw new Error(String(res.status));
      addFromText(await res.text(), url.trim());
    } catch {
      setError(
        'Could not fetch that URL from the browser (most calendar hosts block cross-site requests). Download the .ics file and upload it below instead.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    addFromText(await file.text());
  }

  return (
    <div className="mt-6">
      <SectionHeader index="02" title="Calendars" />
      <div className="border border-border-strong bg-card p-4 shadow-[var(--stack-sm)]">
        {sources.length > 0 && (
          <ul className="mb-4">
            {sources.map((s, idx) => (
              <li
                key={s.id}
                className={cn(
                  'flex items-center gap-3 py-2',
                  idx > 0 && 'border-t border-border',
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-border-strong"
                  style={{ backgroundColor: s.color }}
                />
                <span className="min-w-0 flex-1 text-sm">{s.name}</span>
                {s.url && (
                  <span className="hidden max-w-48 truncate font-mono text-[10px] text-muted-foreground sm:block">
                    {s.url}
                  </span>
                )}
                <Button size="sm" variant="ghost" onClick={() => engine.removeSource(s.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-muted-foreground">
          Import a read-only feed (Google, Outlook and Apple can all export a secret .ics address).
          Imported events show dotted on the master calendar; your Cue items stay solid and
          editable.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            aria-label="Calendar name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name (e.g. Work)"
            className="h-9 w-40 rounded-[2px] border border-border bg-transparent px-2 text-sm outline-none focus:border-border-strong"
          />
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  'h-5 w-5 rounded-full ring-1 ring-border-strong transition-transform',
                  color === c && 'scale-110 ring-2',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            aria-label="ICS URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/basic.ics"
            className="h-9 min-w-56 flex-1 rounded-[2px] border border-border bg-transparent px-2 font-mono text-xs outline-none focus:border-border-strong"
          />
          <Button variant="outline" disabled={busy} onClick={() => void fetchUrl()}>
            {busy ? 'Fetching…' : 'Fetch URL'}
          </Button>
          <label className="inline-flex cursor-pointer">
            <span className="inline-flex h-9 items-center rounded-[2px] border border-border-strong bg-card px-4 text-[13px] font-semibold shadow-[2px_2px_0_0_var(--color-border-strong)] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-accent hover:shadow-[1px_1px_0_0_var(--color-border-strong)]">
              Upload .ics
            </span>
            <input
              type="file"
              accept=".ics,text/calendar"
              aria-label="Upload ICS file"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
        </div>
        {error && <p className="mt-2 text-xs text-muted-foreground">{error}</p>}
      </div>
    </div>
  );
}

function DataSection() {
  const engine = useEngine();

  function exportJson() {
    const data = JSON.stringify(engine.getItems(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cue-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mt-6">
      <SectionHeader index="03" title="Data" />
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border-strong bg-card p-4 shadow-[var(--stack-sm)]">
        <p className="text-sm text-muted-foreground">
          Everything lives on this device. Take it with you any time.
        </p>
        <Button variant="outline" onClick={exportJson}>
          Export JSON
        </Button>
      </div>
    </div>
  );
}

export function SettingsView() {
  return (
    <Panel delay={60}>
      <div className="px-5 py-5 pb-8 sm:px-6">
        <SyncSection />
        <CalendarsSection />
        <DataSection />
      </div>
    </Panel>
  );
}
