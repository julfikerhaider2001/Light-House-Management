// Calendar dates are 'YYYY-MM-DD' strings in the mess timezone (Asia/Dhaka), never Date objects,
// so a phone set to another zone still sees the mess's day.

export const DEFAULT_TZ = 'Asia/Dhaka';

const ymd = (tz: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

export function todayIn(tz = DEFAULT_TZ, now = new Date()): string {
  return ymd(tz).format(now);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function monthDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, i) => `${month.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`,
  );
}

/** The UTC instant of a wall-clock time in a timezone. */
export function zonedInstant(date: string, time: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asZone = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess - (asZone - guess));
}

/** Members may change a date's meals until the cutoff time on the day before (mirrors SQL). */
export function mealDeadline(date: string, cutoff: string, tz = DEFAULT_TZ): Date {
  return zonedInstant(addDays(date, -1), cutoff.slice(0, 5), tz);
}

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "Sat 31 Oct" */
export function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return dayLabel.format(new Date(Date.UTC(y, m - 1, d))).replace(',', '');
}

/** "October 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
