/**
 * Exact rational numbers on BigInt. The sheet divides by meal counts and member counts
 * (92.5314…, 33.333…), so every intermediate value stays exact until a rounding rule
 * from the sheet is applied.
 */
export class Fraction {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    if (d === 0n) throw new RangeError('Division by zero');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = n / g;
    this.d = d / g;
  }

  static readonly ZERO = new Fraction(0n, 1n);
  static readonly ONE = new Fraction(1n, 1n);

  static of(n: bigint | number, d: bigint | number = 1n): Fraction {
    return new Fraction(BigInt(n), BigInt(d));
  }

  /** Parses a decimal such as "92.5", "-53.75", 4500 or 162.5 exactly. */
  static from(value: string | number | Fraction): Fraction {
    if (value instanceof Fraction) return value;
    const text = typeof value === 'number' ? numberText(value) : value.trim();
    const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(text);
    if (!match) throw new RangeError(`Not a decimal: ${String(value)}`);
    const [, sign, whole = '0', frac = ''] = match;
    const n = BigInt(whole + frac) * (sign === '-' ? -1n : 1n);
    return new Fraction(n, 10n ** BigInt(frac.length));
  }

  static sum(values: Iterable<Fraction>): Fraction {
    let acc = Fraction.ZERO;
    for (const v of values) acc = acc.add(v);
    return acc;
  }

  add(o: Fraction): Fraction {
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(o: Fraction): Fraction {
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(o: Fraction): Fraction {
    return new Fraction(this.n * o.n, this.d * o.d);
  }

  div(o: Fraction): Fraction {
    return new Fraction(this.n * o.d, this.d * o.n);
  }

  cmp(o: Fraction): -1 | 0 | 1 {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }

  eq(o: Fraction): boolean {
    return this.cmp(o) === 0;
  }

  isZero(): boolean {
    return this.n === 0n;
  }

  /** Largest integer ≤ this. */
  floor(): bigint {
    const q = this.n / this.d;
    return this.n < 0n && q * this.d !== this.n ? q - 1n : q;
  }

  /** Smallest integer ≥ this (the sheet's ROUNDUP for non-negative values). */
  ceil(): bigint {
    return -new Fraction(-this.n, this.d).floor();
  }

  /** Google Sheets ROUND: half away from zero, to `places` decimals. */
  round(places = 0): Fraction {
    const scale = 10n ** BigInt(places);
    const scaled = this.mul(Fraction.of(scale));
    const abs = scaled.n < 0n ? new Fraction(-scaled.n, scaled.d) : scaled;
    const rounded = abs.add(Fraction.of(1n, 2n)).floor();
    return Fraction.of(scaled.n < 0n ? -rounded : rounded, scale);
  }

  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }

  /** Fixed-point text, rounded half away from zero ("92.53"). */
  toFixed(places: number): string {
    const r = this.round(places);
    const neg = r.n < 0n;
    const scale = 10n ** BigInt(places);
    const units = ((neg ? -r.n : r.n) * scale) / r.d;
    const whole = (units / scale).toString();
    const frac = places > 0 ? '.' + (units % scale).toString().padStart(places, '0') : '';
    return `${neg ? '-' : ''}${whole}${frac}`;
  }

  toJSON(): number {
    return this.toNumber();
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a; // d > 0, so the gcd is at least 1
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Not a decimal: ${String(value)}`);
  // Shortest round-trip text; reject exponent forms rather than guess.
  const text = String(value);
  if (/e/i.test(text)) throw new RangeError(`Out of range: ${text}`);
  return text;
}
