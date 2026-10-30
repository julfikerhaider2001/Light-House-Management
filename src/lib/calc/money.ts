/**
 * Money is held as integer paisa (1 taka = 100 paisa) so sums never drift.
 * Division results are kept as exact fractions until a rounding rule is applied.
 */
export type Paisa = number & { readonly __brand: 'paisa' };

const DECIMAL = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/** Parses "230", "92.5", "-53.75" or a number into exact paisa. Rejects >2 decimals. */
export function toPaisa(value: string | number): Paisa {
  const text = typeof value === 'number' ? numberToText(value) : value.trim();
  const match = DECIMAL.exec(text);
  if (!match) throw new RangeError(`Not a money amount: ${String(value)}`);
  const [, sign, whole = '0', frac = ''] = match;
  const paisa = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(paisa)) throw new RangeError(`Amount too large: ${text}`);
  return (sign && paisa !== 0 ? -paisa : paisa) as Paisa;
}

function numberToText(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Not a money amount: ${String(value)}`);
  // Round-trip through 2 dp only if the number is already exact at 2 dp.
  const fixed = value.toFixed(2);
  if (Math.abs(Number(fixed) - value) > 1e-9) {
    throw new RangeError(`More than 2 decimals: ${String(value)}`);
  }
  return fixed;
}

export function toTaka(paisa: Paisa): number {
  return paisa / 100;
}

export function sumPaisa(values: readonly Paisa[]): Paisa {
  return values.reduce<number>((acc, v) => acc + v, 0) as Paisa;
}

/** Formats paisa as "৳5,426" or "৳-53.75" (decimals only when non-zero). */
export function formatTaka(paisa: Paisa, opts: { decimals?: 0 | 1 | 2 } = {}): string {
  const negative = paisa < 0;
  const abs = Math.abs(paisa);
  const decimals = opts.decimals ?? (abs % 100 === 0 ? 0 : abs % 10 === 0 ? 1 : 2);
  const text = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${negative ? '−' : ''}৳${text}`;
}
