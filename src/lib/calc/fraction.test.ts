import { describe, expect, it } from 'vitest';
import { Fraction } from './fraction';

const F = (v: string | number | Fraction) => Fraction.from(v);

describe('Fraction', () => {
  it('parses decimals exactly and normalises', () => {
    expect(F('92.5').eq(Fraction.of(185, 2))).toBe(true);
    expect(F('-53.75').eq(Fraction.of(-215, 4))).toBe(true);
    expect(F(' +4500 ').eq(Fraction.of(4500))).toBe(true);
    expect(F(162.5).eq(Fraction.of(325, 2))).toBe(true);
    expect(Fraction.of(2, -4).eq(Fraction.of(-1, 2))).toBe(true);
    expect(F(Fraction.ONE)).toBe(Fraction.ONE);
    expect(Fraction.of(0, 5).eq(Fraction.ZERO)).toBe(true);
  });

  it('rejects non-decimals and non-finite numbers', () => {
    expect(() => F('1,000')).toThrow(RangeError);
    expect(() => F('abc')).toThrow(RangeError);
    expect(() => F(Number.NaN)).toThrow(RangeError);
    expect(() => F(1e21)).toThrow(/Out of range/);
    expect(() => Fraction.of(1, 0)).toThrow(/Division by zero/);
  });

  it('does exact arithmetic without float drift', () => {
    expect(F('0.1').add(F('0.2')).eq(F('0.3'))).toBe(true);
    expect(F(9577).div(F('103.5')).mul(F('103.5')).eq(F(9577))).toBe(true);
    expect(F(5).sub(F('0.25')).eq(F('4.75'))).toBe(true);
    expect(Fraction.sum([F(1), F(2), F('0.5')]).eq(F('3.5'))).toBe(true);
  });

  it('compares', () => {
    expect(F(1).cmp(F(2))).toBe(-1);
    expect(F(2).cmp(F(1))).toBe(1);
    expect(F('0.5').cmp(Fraction.of(1, 2))).toBe(0);
    expect(Fraction.ZERO.isZero()).toBe(true);
  });

  it('floors and ceils, including negatives', () => {
    expect(F('2174.48').floor()).toBe(2174n);
    expect(F('2174.48').ceil()).toBe(2175n);
    expect(F('-0.25').floor()).toBe(-1n);
    expect(F('-0.25').ceil()).toBe(0n);
    expect(F(-3).floor()).toBe(-3n);
    expect(F(7).ceil()).toBe(7n);
  });

  it('rounds half away from zero like Google Sheets ROUND', () => {
    expect(F('5350.75').round(0).eq(F(5351))).toBe(true);
    expect(F('2.5').round(0).eq(F(3))).toBe(true);
    expect(F('-2.5').round(0).eq(F(-3))).toBe(true);
    expect(F('-2.4').round(0).eq(F(-2))).toBe(true);
    expect(F('162.5').round(1).eq(F('162.5'))).toBe(true);
    expect(Fraction.of(1000, 3).round(1).eq(F('333.3'))).toBe(true);
    expect(Fraction.of(2, 3).round(2).eq(F('0.67'))).toBe(true);
  });

  it('formats as fixed-point text and numbers', () => {
    expect(F(9577).div(F('103.5')).toFixed(2)).toBe('92.53');
    expect(F('-53.75').toFixed(1)).toBe('-53.8');
    expect(F('-0.004').toFixed(2)).toBe('0.00');
    expect(F(5426).toFixed(0)).toBe('5426');
    expect(F('0.05').toFixed(2)).toBe('0.05');
    expect(F('61.25').toNumber()).toBe(61.25);
    expect(JSON.stringify({ x: F('162.5') })).toBe('{"x":162.5}');
  });
});
