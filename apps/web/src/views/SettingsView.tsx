import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { generateSyncKey, makeLinkCode, parseLinkCode, isOnline } from '@cue/engine';
import { Panel } from '../components/Panel';
import { useEngine, useItems } from '../useEngine';
import { syncManager, useSyncStatus, DEFAULT_HUB, type SyncConfig } from '../sync/manager';
import { spaceManager, useActiveSpace } from '../spaces/manager';
import { deviceId, deviceName, setDeviceName, deviceSurface } from '../devices/identity';
import { Button } from '../components/ui/button';
import { QrScanner } from '../components/QrScanner';
import { cn } from '../lib/utils';
import { timeAgo } from '../lib/time';

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
  const [scanning, setScanning] = useState(false);

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

  function joinWithCode(code: string): boolean {
    setError(null);
    const parsed = parseLinkCode(code.trim());
    if (!parsed) {
      setError('That code is not valid.');
      return false;
    }
    const cfg: SyncConfig = {
      room: parsed.room,
      key: parsed.key,
      hub: parsed.hub ?? hub.trim() ?? DEFAULT_HUB,
    };
    syncManager.configure(cfg);
    setConfig(cfg);
    setJoinCode('');
    return true;
  }

  function joinSpace(e: FormEvent) {
    e.preventDefault();
    joinWithCode(joinCode);
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
              <Button type="button" variant="outline" onClick={() => setScanning(true)}>
                Scan QR
              </Button>
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

      {scanning && (
        <QrScanner
          onScan={(text) => {
            setScanning(false);
            joinWithCode(text); // joins on success; sets the error shown above on failure
          }}
          onClose={() => setScanning(false)}
        />
      )}
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

function SpacesSection() {
  const { spaces } = useActiveSpace();
  const [name, setName] = useState('');
  const [hub, setHub] = useState(DEFAULT_HUB);
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteQr, setInviteQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const invite = inviteFor
    ? (() => {
        const s = spaces.find((x) => x.id === inviteFor);
        return s ? makeLinkCode({ room: s.room, key: s.key, hub: s.hub }) : null;
      })()
    : null;

  useEffect(() => {
    if (invite) {
      QRCode.toDataURL(invite, { margin: 1, width: 220 })
        .then(setInviteQr)
        .catch(() => setInviteQr(null));
    } else {
      setInviteQr(null);
    }
  }, [invite]);

  async function create() {
    setError(null);
    if (!name.trim()) {
      setError('Give the space a name first.');
      return;
    }
    const s = await spaceManager.create(name, hub);
    setName('');
    spaceManager.setActive(s.id);
  }

  function joinWithCode(code: string): boolean {
    setError(null);
    const parsed = parseLinkCode(code.trim());
    if (!parsed) {
      setError('That space code is not valid.');
      return false;
    }
    const s = spaceManager.join({
      name: joinName.trim() || 'Shared space',
      room: parsed.room,
      key: parsed.key,
      hub: parsed.hub ?? DEFAULT_HUB,
    });
    setJoinCode('');
    setJoinName('');
    spaceManager.setActive(s.id);
    return true;
  }

  function join(e: FormEvent) {
    e.preventDefault();
    joinWithCode(joinCode);
  }

  return (
    <div className="mt-6">
      <SectionHeader index="05" title="Shared spaces" />
      <div className="border border-border-strong bg-card p-4 shadow-[var(--stack-sm)]">
        <p className="text-sm text-muted-foreground">
          A shared space is a separate, end-to-end encrypted world — its own queue, calendar and
          files — shared with everyone who has its invite code. Anyone with the code can read and
          write everything in the space, so share it like a house key.
        </p>

        {spaces.length > 0 && (
          <ul className="mt-3 border-t border-border">
            {spaces.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 border-b border-border py-2">
                <span className="min-w-0 flex-1 text-sm font-semibold">{s.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {spaceManager.status(s.id) ?? 'idle'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInviteFor(inviteFor === s.id ? null : s.id)}
                >
                  {inviteFor === s.id ? 'Hide invite' : 'Invite'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => spaceManager.leave(s.id)}>
                  Leave
                </Button>
              </li>
            ))}
          </ul>
        )}
        {invite && (
          <div className="mt-2">
            <p className="mb-2 font-mono text-[11px] text-muted-foreground">
              scan on the other device, or paste the code there — anyone with this code can read
              and write the space
            </p>
            {inviteQr && (
              <img src={inviteQr} alt="Space invite QR code" className="border border-border-strong" />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="max-w-full overflow-x-auto whitespace-nowrap border border-border bg-background px-2 py-1 font-mono text-[10px]">
                {invite}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard?.writeText(invite)}
              >
                Copy
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <input
            aria-label="Space name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="new space name (e.g. Family)"
            className="h-9 w-48 rounded-[2px] border border-border bg-transparent px-2 text-sm outline-none focus:border-border-strong"
          />
          <input
            aria-label="Space hub URL"
            value={hub}
            onChange={(e) => setHub(e.target.value)}
            placeholder={DEFAULT_HUB}
            className="h-9 min-w-44 flex-1 rounded-[2px] border border-border bg-transparent px-2 font-mono text-xs outline-none focus:border-border-strong"
          />
          <Button onClick={() => void create()}>Create space</Button>
        </div>

        <form onSubmit={join} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            aria-label="Joined space name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="name it locally"
            className="h-9 w-48 rounded-[2px] border border-border bg-transparent px-2 text-sm outline-none focus:border-border-strong"
          />
          <input
            aria-label="Space invite code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="paste a space invite code (cue1.…)"
            className="h-9 min-w-44 flex-1 rounded-[2px] border border-border bg-transparent px-2 font-mono text-xs outline-none focus:border-border-strong"
          />
          <Button type="button" variant="outline" onClick={() => setScanning(true)}>
            Scan QR
          </Button>
          <Button type="submit" variant="outline">
            Join space
          </Button>
        </form>
        {error && <p className="mt-2 font-mono text-xs text-muted-foreground">{error}</p>}
      </div>

      {scanning && (
        <QrScanner
          onScan={(text) => {
            setScanning(false);
            joinWithCode(text);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}

function AiSection() {
  const [key, setKey] = useState(() => localStorage.getItem('cue-ai-key') ?? '');
  const [saved, setSaved] = useState(false);

  function save() {
    try {
      if (key.trim()) localStorage.setItem('cue-ai-key', key.trim());
      else localStorage.removeItem('cue-ai-key');
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      /* private mode */
    }
  }

  return (
    <div className="mt-6">
      <SectionHeader index="04" title="Assistant" />
      <div className="border border-border-strong bg-card p-4 shadow-[var(--stack-sm)]">
        <p className="text-sm text-muted-foreground">
          The assistant uses your own Anthropic API key. It is stored only on this device and
          never synced; requests go directly from your browser to the model. Get a key at{' '}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            console.anthropic.com
          </a>
          .
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            aria-label="Anthropic API key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            className="h-9 min-w-56 flex-1 rounded-[2px] border border-border bg-transparent px-2 font-mono text-xs outline-none focus:border-border-strong"
          />
          <Button variant="outline" onClick={save}>
            {saved ? 'Saved' : 'Save key'}
          </Button>
        </div>
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

function DevicesSection() {
  const engine = useEngine();
  useItems(); // re-render when the device registry (or anything) changes
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState(deviceName());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000); // refresh online/last-seen
    return () => clearInterval(iv);
  }, []);

  const meId = deviceId();
  const devices = engine.getDevices();

  function saveName(e: FormEvent) {
    e.preventDefault();
    setDeviceName(name);
    engine.registerDevice({ id: meId, name: deviceName(), surface: deviceSurface() });
    setEditing(false);
  }

  const chip =
    'ml-2 bg-primary px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-primary-foreground';

  return (
    <section className="mb-8">
      <SectionHeader index="06" title="Devices in this space" />
      {devices.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-6 text-center font-mono text-xs text-muted-foreground">
          just this device so far — linked devices appear here once they join
        </p>
      ) : (
        <ul className="border border-border-strong bg-card shadow-[var(--stack-sm)]">
          {devices.map((d, i) => {
            const isMe = d.id === meId;
            const online = isMe || isOnline(d, now);
            return (
              <li
                key={d.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 px-4 py-3',
                  i > 0 && 'border-t border-border',
                )}
              >
                <span
                  title={online ? 'online' : 'offline'}
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full ring-1 ring-border-strong',
                    online ? 'bg-primary' : 'bg-card',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {d.name}
                  {isMe && <span className={chip}>this device</span>}
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {d.surface}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {online ? 'online' : timeAgo(d.lastSeen)}
                </span>
                {!isMe && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => engine.removeDevice(d.id)}
                    title="Remove from this list. Note: it doesn't revoke the space key — the device can rejoin."
                  >
                    Forget
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2">
        {editing ? (
          <form onSubmit={saveName} className="flex gap-1.5">
            <input
              aria-label="Device name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 min-w-0 flex-1 border border-border bg-card px-2 font-mono text-[12px] outline-none focus:border-border-strong"
            />
            <Button size="sm" type="submit">
              Save
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setName(deviceName());
              setEditing(true);
            }}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            rename this device
          </button>
        )}
      </div>

      <p className="mt-3 border-l-2 border-border pl-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
        everyone in a space is equal — anyone who has the link code can read and change everything.
        &ldquo;Forget&rdquo; only clears the list entry; enforced removal (revoking a device&rsquo;s
        access) needs per-person keys, which are planned.
      </p>
    </section>
  );
}

export function SettingsView() {
  return (
    <Panel delay={60}>
      <div className="px-5 py-5 pb-8 sm:px-6">
        <SyncSection />
        <SpacesSection />
        <DevicesSection />
        <CalendarsSection />
        <AiSection />
        <DataSection />
      </div>
    </Panel>
  );
}
