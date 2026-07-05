import { describe, it, expect } from 'vitest';
import { parseIcsEvents } from './calendar';
import { createEngine } from './index';

const SIMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//EN',
  'BEGIN:VEVENT',
  'UID:one@test',
  'DTSTART:20260710T090000Z',
  'DTEND:20260710T100000Z',
  'SUMMARY:Dentist',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const RECURRING_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//EN',
  'BEGIN:VEVENT',
  'UID:weekly@test',
  'DTSTART:20260701T090000Z',
  'DTEND:20260701T093000Z',
  'RRULE:FREQ=WEEKLY;COUNT=5',
  'SUMMARY:Standup',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const JULY_START = Date.UTC(2026, 6, 1);
const JULY_END = Date.UTC(2026, 7, 1);

describe('parseIcsEvents', () => {
  it('parses a simple event with title and times', () => {
    const events = parseIcsEvents(SIMPLE_ICS, JULY_START, JULY_END);
    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe('Dentist');
    expect(events[0]!.start).toBe(Date.UTC(2026, 6, 10, 9));
    expect(events[0]!.end).toBe(Date.UTC(2026, 6, 10, 10));
    expect(events[0]!.allDay).toBe(false);
  });

  it('expands a weekly recurrence within the range', () => {
    const events = parseIcsEvents(RECURRING_ICS, JULY_START, JULY_END);
    expect(events).toHaveLength(5);
    expect(events.map((e) => new Date(e.start).getUTCDate())).toEqual([1, 8, 15, 22, 29]);
  });

  it('filters events outside the range', () => {
    const events = parseIcsEvents(SIMPLE_ICS, Date.UTC(2026, 8, 1), Date.UTC(2026, 9, 1));
    expect(events).toHaveLength(0);
  });

  it('returns [] for garbage input instead of throwing', () => {
    expect(parseIcsEvents('not an ics file', JULY_START, JULY_END)).toEqual([]);
  });
});

describe('engine calendar sources', () => {
  it('addSource/getSources/removeSource round-trip', () => {
    const engine = createEngine();
    const src = engine.addSource({ name: 'Work', color: '#4a90d9', icsText: SIMPLE_ICS });
    expect(src.name).toBe('Work');
    expect(engine.getSources()).toHaveLength(1);
    engine.removeSource(src.id);
    expect(engine.getSources()).toHaveLength(0);
  });

  it('getCalendarEvents merges locked imported events with scheduled items', () => {
    const engine = createEngine();
    engine.addSource({ name: 'Work', color: '#4a90d9', icsText: SIMPLE_ICS });
    const item = engine.addItem('prep meeting');
    engine.schedule(item.id, Date.UTC(2026, 6, 10, 14));

    const events = engine.getCalendarEvents(JULY_START, JULY_END);
    expect(events).toHaveLength(2);

    const imported = events.find((e) => e.locked);
    const own = events.find((e) => !e.locked);
    expect(imported?.title).toBe('Dentist');
    expect(imported?.color).toBe('#4a90d9');
    expect(own?.title).toBe('prep meeting');
    expect(own?.start).toBe(Date.UTC(2026, 6, 10, 14));
  });

  it('events are sorted by start time', () => {
    const engine = createEngine();
    engine.addSource({ name: 'Work', color: '#4a90d9', icsText: SIMPLE_ICS });
    const item = engine.addItem('early thing');
    engine.schedule(item.id, Date.UTC(2026, 6, 10, 6));
    const events = engine.getCalendarEvents(JULY_START, JULY_END);
    expect(events.map((e) => e.title)).toEqual(['early thing', 'Dentist']);
  });
});
