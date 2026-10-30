import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatCountdown,
  formatDay,
  formatMonth,
  mealDeadline,
  monthDays,
  todayIn,
  zonedInstant,
} from './time';

describe('time helpers (Asia/Dhaka)', () => {
  it('finds the mess day regardless of the device zone', () => {
    // 19:30 UTC on 30 Oct is 01:30 on 31 Oct in Dhaka.
    expect(todayIn('Asia/Dhaka', new Date('2026-10-30T19:30:00Z'))).toBe('2026-10-31');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lists every day of a month', () => {
    expect(monthDays('2026-10-01')).toHaveLength(31);
    expect(monthDays('2026-02-01').at(-1)).toBe('2026-02-28');
  });

  it('converts wall-clock times to instants', () => {
    expect(zonedInstant('2026-10-25', '22:00').toISOString()).toBe('2026-10-25T16:00:00.000Z');
  });

  it('matches the SQL meal deadline', () => {
    expect(mealDeadline('2026-10-26', '22:00:00').toISOString()).toBe('2026-10-25T16:00:00.000Z');
  });

  it('formats labels', () => {
    expect(formatDay('2026-10-31')).toBe('Sat 31 Oct');
    expect(formatMonth('2026-10-01')).toBe('October 2026');
    expect(formatCountdown(3_723_000)).toBe('01:02:03');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});
