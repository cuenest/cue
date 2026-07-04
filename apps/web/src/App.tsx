import type { ReactNode } from 'react';
import type { CueEngine } from '@cue/engine';
import { EngineContext } from './useEngine';
import { Capture } from './components/Capture';
import { Focus } from './components/Focus';
import { Inbox } from './components/Inbox';
import { ThemeToggle } from './components/ThemeToggle';
import { ScrollProgress } from './components/ScrollProgress';
import { cn } from './lib/utils';

function Marker({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn('marker', className)} />;
}

/** A horizontal rule across the column with dot pins where it meets the frame. */
function Panel({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('rise relative border-t border-border', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Marker className="-left-[3px] -top-[3px]" />
      <Marker className="-right-[3px] -top-[3px]" />
      {children}
    </div>
  );
}

export function App({
  engine,
  persistent = true,
}: {
  engine: CueEngine;
  persistent?: boolean;
}) {
  function exportJson() {
    const data = JSON.stringify(engine.getItems(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cue-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <EngineContext.Provider value={engine}>
      <ScrollProgress />

      {!persistent && (
        <p
          role="status"
          className="border-b border-border-strong bg-primary px-5 py-2 font-mono text-xs font-medium text-primary-foreground"
        >
          Storage unavailable — changes won&rsquo;t persist in this session.
        </p>
      )}

      <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col border-x border-border">
        <Panel delay={0}>
          <header className="flex items-center justify-between px-5 py-4 sm:px-6">
            <h1 className="flex items-baseline gap-1.5 font-sans text-2xl font-extrabold tracking-tight">
              Cue
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 bg-primary ring-1 ring-border-strong"
              />
            </h1>
            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                capture → focus → done
              </span>
              <ThemeToggle />
            </div>
          </header>
        </Panel>

        <Panel delay={60}>
          <Capture />
        </Panel>

        <Panel delay={120}>
          <Focus />
        </Panel>

        <Panel delay={180}>
          <Inbox />
        </Panel>

        <Panel delay={240} className="mt-auto">
          <footer className="flex items-center justify-between px-5 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:px-6">
            <span>local-first · zero-knowledge</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={exportJson}
                className="uppercase tracking-[0.2em] underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                export
              </button>
              <span>cuenest / cue</span>
            </div>
          </footer>
        </Panel>

        <Marker className="-bottom-[3px] -left-[3px]" />
        <Marker className="-bottom-[3px] -right-[3px]" />
      </main>
    </EngineContext.Provider>
  );
}
