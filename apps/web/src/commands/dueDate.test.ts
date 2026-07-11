import { describe, it, expect } from 'vitest';
import { parseDue } from './dueDate';

// A fixed reference: Wednesday 2026-07-08, 10:00 local.
const NOW = new Date(2026, 6, 8, 10, 0, 0, 0).getTime();
const at = (d: number) => new Date(d);

describe('parseDue', () => {
  it('returns null for gibberish / empty', () => {
    expect(parseDue('', NOW)).toBeNull();
    expect(parseDue('whenever', NOW)).toBeNull();
  });

  it('relative "in N units"', () => {
    expect(parseDue('in 30 min', NOW)).toBe(NOW + 30 * 60_000);
    expect(parseDue('in 2 hours', NOW)).toBe(NOW + 2 * 3_600_000);
    expect(parseDue('in 3 days', NOW)).toBe(NOW + 3 * 86_400_000);
    expect(parseDue('in 1 week', NOW)).toBe(NOW + 604_800_000);
  });

  it('today / tonight / tomorrow with default times', () => {
    expect(at(parseDue('today', NOW)!).getHours()).toBe(9);
    const tonight = at(parseDue('tonight', NOW)!);
    expect(tonight.getHours()).toBe(20);
    expect(tonight.getDate()).toBe(8);
    const tom = at(parseDue('tomorrow', NOW)!);
    expect(tom.getDate()).toBe(9);
    expect(tom.getHours()).toBe(9);
  });

  it('clock time only → today, or tomorrow if past', () => {
    const fivePm = at(parseDue('5pm', NOW)!); // 17:00 today (future)
    expect(fivePm.getHours()).toBe(17);
    expect(fivePm.getDate()).toBe(8);
    const nineAm = at(parseDue('9am', NOW)!); // 09:00 already passed → tomorrow
    expect(nineAm.getHours()).toBe(9);
    expect(nineAm.getDate()).toBe(9);
  });

  it('weekday → next occurrence (never today)', () => {
    const fri = at(parseDue('friday', NOW)!); // Wed → Fri = +2 days
    expect(fri.getDay()).toBe(5);
    expect(fri.getDate()).toBe(10);
    const wed = at(parseDue('wed', NOW)!); // today is Wed → next Wed (+7)
    expect(wed.getDay()).toBe(3);
    expect(wed.getDate()).toBe(15);
  });

  it('combined date + time', () => {
    const t = at(parseDue('tomorrow 5pm', NOW)!);
    expect(t.getDate()).toBe(9);
    expect(t.getHours()).toBe(17);
    const f = at(parseDue('fri 9:30am', NOW)!);
    expect(f.getDay()).toBe(5);
    expect(f.getHours()).toBe(9);
    expect(f.getMinutes()).toBe(30);
  });
});
