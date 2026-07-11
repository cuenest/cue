/**
 * A small natural-language date parser for the #due: command. Returns a
 * timestamp (ms) or null if the expression isn't understood. Intentionally
 * covers the common quick cases (today/tomorrow/tonight, weekdays, "in N …",
 * and clock times) rather than being a full date library.
 */
const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function extractTime(s: string): { minutes: number | null; rest: string } {
  const tm = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)|(\d{1,2}):(\d{2})/.exec(s);
  if (!tm) return { minutes: null, rest: s };
  let hh: number;
  let mm: number;
  if (tm[3]) {
    hh = parseInt(tm[1]!, 10) % 12;
    mm = tm[2] ? parseInt(tm[2], 10) : 0;
    if (tm[3] === 'pm') hh += 12;
  } else {
    hh = parseInt(tm[4]!, 10);
    mm = parseInt(tm[5]!, 10);
  }
  if (hh > 23 || mm > 59) return { minutes: null, rest: s };
  return { minutes: hh * 60 + mm, rest: s.replace(tm[0], '').trim() };
}

export function parseDue(input: string, now: number = Date.now()): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;

  // relative: "in 30 min", "in 2 hours", "in 3 days", "in 1 week"
  const rel = /^in (\d+) ?(min|mins|minute|minutes|m|hr|hrs|hour|hours|h|day|days|d|week|weeks|w)$/.exec(s);
  if (rel) {
    const n = parseInt(rel[1]!, 10);
    const u = rel[2]!.startsWith('mi') || rel[2] === 'm' ? 'm' : rel[2]!.startsWith('h') ? 'h' : rel[2]!.startsWith('d') ? 'd' : 'w';
    return now + n * UNIT_MS[u]!;
  }

  const { minutes, rest } = extractTime(s);
  const setTime = (d: Date, def = 9 * 60): Date => {
    const mins = minutes ?? def;
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d;
  };

  // time only → today at that time, or tomorrow if already past
  if (rest === '' && minutes != null) {
    const t = setTime(new Date(now));
    if (t.getTime() <= now) t.setDate(t.getDate() + 1);
    return t.getTime();
  }

  if (rest === 'today' || rest === 'tod') return setTime(new Date(now)).getTime();
  if (rest === 'tonight') return setTime(new Date(now), 20 * 60).getTime();
  if (rest === 'tomorrow' || rest === 'tmr' || rest === 'tom') {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return setTime(t).getTime();
  }
  if (rest === 'next week') {
    const t = new Date(now);
    t.setDate(t.getDate() + 7);
    return setTime(t).getTime();
  }

  // weekday: "fri", "friday", "mon" → the next such day (never today)
  const wd = DAYS.indexOf(rest.slice(0, 3));
  if (wd >= 0 && (rest.length === 3 || rest.startsWith(DAYS[wd]!))) {
    const t = new Date(now);
    let delta = (wd - t.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    t.setDate(t.getDate() + delta);
    return setTime(t).getTime();
  }

  return null;
}
