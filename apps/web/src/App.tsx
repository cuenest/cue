import type { CueEngine } from '@cue/engine';
import { EngineContext } from './useEngine';
import { Panel, Marker } from './components/Panel';
import { ThemeToggle } from './components/ThemeToggle';
import { ScrollProgress } from './components/ScrollProgress';
import { SpaceSwitcher } from './components/SpaceSwitcher';
import { BottomNav } from './components/BottomNav';
import { QueueView } from './views/QueueView';
import { CalendarView } from './views/CalendarView';
import { AskView } from './views/AskView';
import { FilesView } from './views/FilesView';
import { SettingsView } from './views/SettingsView';
import { useRoute, navigate, type Route } from './router';
import { useSyncStatus } from './sync/manager';
import { spaceManager, useActiveSpace } from './spaces/manager';
import { usePresence } from './devices/identity';
import { cn } from './lib/utils';

const ROUTES: Route[] = ['queue', 'calendar', 'ask', 'files', 'settings'];

function Nav({ active }: { active: Route }) {
  const syncStatus = useSyncStatus();
  return (
    <nav className="flex items-center gap-1.5">
      {ROUTES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => navigate(r)}
          className={cn(
            'rounded-[2px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors',
            active === r
              ? 'border-border-strong bg-primary font-semibold text-primary-foreground'
              : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
          )}
        >
          {r}
          {r === 'settings' && syncStatus === 'connected' && (
            <span aria-hidden="true" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />
          )}
        </button>
      ))}
    </nav>
  );
}

export function App({
  engine,
  persistent = true,
}: {
  engine: CueEngine;
  persistent?: boolean;
}) {
  const route = useRoute();
  spaceManager.init(engine);
  const { engine: activeEngine } = useActiveSpace();
  usePresence(activeEngine); // announce this device in the active space + heartbeat

  return (
    <EngineContext.Provider value={activeEngine}>
      <ScrollProgress />

      {!persistent && (
        <p
          role="status"
          className="border-b border-border-strong bg-primary px-5 py-2 font-mono text-xs font-medium text-primary-foreground"
        >
          Storage unavailable — changes won&rsquo;t persist in this session.
        </p>
      )}

      <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col border-x border-border pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <Panel delay={0} className="z-40">
          <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <h1 className="flex items-baseline gap-1.5 font-sans text-2xl font-extrabold tracking-tight">
              Cue
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 bg-primary ring-1 ring-border-strong"
              />
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <SpaceSwitcher />
              <div className="hidden sm:block">
                <Nav active={route} />
              </div>
              <ThemeToggle />
            </div>
          </header>
        </Panel>

        {route === 'queue' && <QueueView />}
        {route === 'calendar' && <CalendarView />}
        {route === 'ask' && <AskView />}
        {route === 'files' && <FilesView />}
        {route === 'settings' && <SettingsView />}

        <Panel delay={240} className="mt-auto hidden sm:block">
          <footer className="flex items-center justify-between px-5 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:px-6">
            <span>local-first · zero-knowledge</span>
            <span>cuenest / cue</span>
          </footer>
        </Panel>

        <Marker className="-bottom-[3px] -left-[3px] hidden sm:block" />
        <Marker className="-bottom-[3px] -right-[3px] hidden sm:block" />
      </main>

      <BottomNav active={route} />
    </EngineContext.Provider>
  );
}
