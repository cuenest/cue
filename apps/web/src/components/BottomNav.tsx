import { navigate, type Route } from '../router';
import { useSyncStatus } from '../sync/manager';
import { cn } from '../lib/utils';

const ROUTES: Route[] = ['queue', 'calendar', 'ask', 'files', 'notes', 'settings'];
const LABELS: Record<Route, string> = {
  queue: 'Queue',
  calendar: 'Calendar',
  ask: 'Ask',
  files: 'Files',
  notes: 'Notes',
  settings: 'Settings',
};

function RouteIcon({ route, className }: { route: Route; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (route) {
    case 'queue':
      return (
        <svg {...common}>
          <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16.5" rx="1.5" />
          <line x1="3" y1="9.5" x2="21" y2="9.5" />
          <line x1="8" y1="2.5" x2="8" y2="6" />
          <line x1="16" y1="2.5" x2="16" y2="6" />
        </svg>
      );
    case 'ask':
      return (
        <svg {...common}>
          <path d="M4 5h16v10H10l-4 4v-4H4z" />
          <path d="M9.5 8.2a2.4 2.4 0 1 1 3 2.3c-.7.2-1 .6-1 1.3" />
          <circle cx="11.5" cy="12.9" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'files':
      return (
        <svg {...common}>
          <path d="M6 3h7l5 5v13H6z" />
          <path d="M13 3v5h5" />
        </svg>
      );
    case 'notes':
      return (
        <svg {...common}>
          <rect x="5" y="3.5" width="14" height="17" rx="2" />
          <line x1="8.5" y1="8" x2="15.5" y2="8" />
          <line x1="8.5" y1="12" x2="15.5" y2="12" />
          <line x1="8.5" y1="16" x2="13" y2="16" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <line x1="4" y1="8" x2="20" y2="8" />
          <line x1="4" y1="16" x2="20" y2="16" />
          <circle cx="9" cy="8" r="2.2" fill="var(--color-background)" />
          <circle cx="15" cy="16" r="2.2" fill="var(--color-background)" />
        </svg>
      );
  }
}

/** Fixed bottom tab bar shown on phones (hidden ≥ sm, where the top text nav is used). */
export function BottomNav({ active }: { active: Route }) {
  const syncStatus = useSyncStatus();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-strong bg-background/95 backdrop-blur-sm sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {ROUTES.map((r) => {
          const on = active === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => navigate(r)}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 py-2 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors',
                on ? 'text-foreground' : 'text-muted-foreground active:text-foreground',
              )}
            >
              {on && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-[3px] w-7 rounded-b-full bg-primary"
                />
              )}
              <span className="relative">
                <RouteIcon route={r} className="h-[22px] w-[22px]" />
                {r === 'settings' && syncStatus === 'connected' && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background"
                  />
                )}
              </span>
              <span>{LABELS[r]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
