import { Fraction } from './calc/fraction';

type Num = number | Fraction;

const toNumber = (v: Num) => (v instanceof Fraction ? v.toNumber() : v);

/** "৳5,426", "−৳373", "৳162.5". Decimals shown only when the value has them, up to `max`. */
export function taka(value: Num, max = 2): string {
  const n = toNumber(value);
  const text = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  });
  return `${n < 0 ? '−' : ''}৳${text}`;
}

/** Meals as "2", "1.5". */
export function mealCount(value: Num): string {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length > 1 ? (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '') : name.slice(0, 2);
  return letters.toUpperCase();
}
