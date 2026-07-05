import { useMemo, useState } from 'react';
import type { CalendarEvent } from '@cue/engine';
import { Panel } from '../components/Panel';
import { useEngine, useItems } from '../useEngine';
import { navigate } from '../router';
import { cn } from '../lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday-started 6-week grid covering the cursor's month. */
function gridDays(cursor: Date): number[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Mon=0
  const start = first.getTime() - offset * DAY_MS;
  return Array.from({ length: 42 }, (_, i) => startOfDay(start + i * DAY_MS));
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function CalendarView() {
  const engine = useEngine();
  const items = useItems(); // re-render on any engine change (items or sources)
  void items;

  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<number | null>(null);

  const days = useMemo(() => gridDays(cursor), [cursor]);
  const gridStart = days[0]!;
  const gridEnd = days[days.length - 1]! + DAY_MS;

  const events = useMemo(
    () => engine.getCalendarEvents(gridStart, gridEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, gridStart, gridEnd, items],
  );
  const sources = engine.getSources();
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? 'imported';

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const e of events) {
      // place the event on each day it touches within the grid
      for (let d = startOfDay(e.start); d < e.end; d += DAY_MS) {
        if (d < gridStart || d >= gridEnd) continue;
        const list = map.get(d) ?? [];
        list.push(e);
        map.set(d, list);
      }
    }
    return map;
  }, [events, gridStart, gridEnd]);

  const today = startOfDay(Date.now());
  const monthTitle = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <Panel delay={60}>
      <div className="px-5 py-5 pb-8 sm:px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">
              02
            </span>
            <span>Master calendar</span>
          </div>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
            dotted = imported · solid = cue
          </span>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-sans text-xl font-bold tracking-tight">{monthTitle}</h2>
          <div className="flex gap-1.5">
            {(
              [
                ['‹', -1],
                ['today', 0],
                ['›', 1],
              ] as const
            ).map(([label, delta]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setSelected(null);
                  setCursor(
                    delta === 0
                      ? new Date()
                      : new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1),
                  );
                }}
                className="rounded-[2px] border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border-strong bg-card shadow-[var(--stack-sm)]">
          <div className="grid grid-cols-7 gap-px border-b border-border bg-border p-px pb-0">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="bg-card px-1.5 py-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border p-px pt-0">
            {days.map((day) => {
              const inMonth = new Date(day).getMonth() === cursor.getMonth();
              const dayEvents = byDay.get(day) ?? [];
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(selected === day ? null : day)}
                  className={cn(
                    'min-h-[86px] bg-card p-1.5 text-left align-top transition-colors hover:bg-accent/40',
                    selected === day && 'bg-accent/60',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block font-mono text-[10px]',
                      inMonth ? 'text-muted-foreground' : 'text-muted-foreground/40',
                      day === today &&
                        'bg-primary px-1 font-semibold text-primary-foreground',
                    )}
                  >
                    {new Date(day).getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id + String(day)}
                        className={cn(
                          'truncate px-1 py-px text-[10px] leading-tight',
                          e.locked
                            ? 'border border-dashed border-border text-muted-foreground'
                            : 'border-l-2 border-primary bg-accent/70 text-foreground',
                        )}
                      >
                        {e.locked && (
                          <span
                            aria-hidden="true"
                            className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                            style={{ backgroundColor: e.color }}
                          />
                        )}
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="px-1 font-mono text-[9px] text-muted-foreground">
                        +{dayEvents.length - 3}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="mt-3 border border-border-strong bg-card shadow-[var(--stack-sm)]">
            <div className="border-b border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {new Date(selected).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            {selectedEvents.length === 0 ? (
              <p className="px-4 py-4 font-mono text-xs text-muted-foreground">nothing this day</p>
            ) : (
              <ul>
                {selectedEvents.map((e, idx) => (
                  <li
                    key={e.id}
                    className={cn(
                      'flex items-baseline gap-3 px-4 py-2.5',
                      idx > 0 && 'border-t border-border',
                    )}
                  >
                    <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">
                      {e.allDay ? 'all day' : `${fmtTime(e.start)}–${fmtTime(e.end)}`}
                    </span>
                    <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
                      {e.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {e.locked ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                            style={{ backgroundColor: e.color }}
                          />
                          {sourceName(e.refId)}
                        </>
                      ) : (
                        'cue'
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {sources.length === 0 && (
          <p className="mt-3 border border-dashed border-border px-4 py-4 text-center font-mono text-xs text-muted-foreground">
            no calendars imported yet —{' '}
            <button
              type="button"
              onClick={() => navigate('settings')}
              className="underline underline-offset-2 hover:text-foreground"
            >
              add one in settings
            </button>
          </p>
        )}
      </div>
    </Panel>
  );
}
