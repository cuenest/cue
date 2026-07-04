import ICAL from 'ical.js';

/** An external calendar feed the user imported. Events from it are read-only. */
export interface CalendarSource {
  id: string;
  name: string;
  color: string;
  url?: string;
  addedAt: number;
}

/** A single occurrence on the master calendar. */
export interface CalendarEvent {
  id: string;
  title: string;
  start: number; // epoch ms
  end: number; // epoch ms
  allDay: boolean;
  /** true = imported (read-only, rendered dotted); false = a Cue item (editable, solid) */
  locked: boolean;
  /** source id for imported events; the item id for Cue items */
  refId: string;
  color?: string;
}

const MAX_OCCURRENCES = 500;

/** Expand VEVENTs (including RRULEs) that intersect [rangeStart, rangeEnd). Never throws. */
export function parseIcsEvents(
  icsText: string,
  rangeStart: number,
  rangeEnd: number,
): Array<Omit<CalendarEvent, 'locked' | 'refId' | 'color'>> {
  try {
    const jcal = ICAL.parse(icsText);
    const comp = new ICAL.Component(jcal);
    const out: Array<Omit<CalendarEvent, 'locked' | 'refId' | 'color'>> = [];

    for (const vevent of comp.getAllSubcomponents('vevent')) {
      const event = new ICAL.Event(vevent);
      const uid = event.uid || Math.random().toString(36).slice(2);

      if (event.isRecurring()) {
        const iterator = event.iterator();
        let next: ICAL.Time | null;
        let n = 0;
        while ((next = iterator.next()) && n < MAX_OCCURRENCES) {
          n += 1;
          const occ = event.getOccurrenceDetails(next);
          const start = occ.startDate.toJSDate().getTime();
          const end = occ.endDate.toJSDate().getTime();
          if (start >= rangeEnd) break;
          if (end <= rangeStart) continue;
          out.push({
            id: `${uid}:${start}`,
            title: event.summary || '(untitled)',
            start,
            end,
            allDay: occ.startDate.isDate,
          });
        }
      } else {
        const start = event.startDate.toJSDate().getTime();
        const end = event.endDate ? event.endDate.toJSDate().getTime() : start;
        if (start < rangeEnd && end > rangeStart) {
          out.push({
            id: uid,
            title: event.summary || '(untitled)',
            start,
            end,
            allDay: event.startDate.isDate,
          });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}
