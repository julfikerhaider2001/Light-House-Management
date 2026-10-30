import { describe, expect, it } from 'vitest';
import { formatTaka, sumPaisa, toPaisa, toTaka } from './money';

describe('toPaisa', () => {
  it.each([
    ['230', 23000],
    ['92.5', 9250],
    ['-53.75', -5375],
    ['0.05', 5],
    [' 15500 ', 1550000],
    ['-0', 0],
  ])('parses %s', (input, expected) => {
    expect(toPaisa(input)).toBe(expected);
  });

  it('parses numbers with at most 2 decimals', () => {
    expect(toPaisa(162.5)).toBe(16250);
    expect(toPaisa(0.1 + 0.2)).toBe(30);
    expect(toPaisa(-61.25)).toBe(-6125);
  });

  it.each(['', 'abc', '1.234', '1,000', '৳5'])('rejects %j', (input) => {
    expect(() => toPaisa(input)).toThrow(RangeError);
  });

  it('rejects numbers with more than 2 decimals or non-finite values', () => {
    expect(() => toPaisa(92.5314)).toThrow(RangeError);
    expect(() => toPaisa(Number.NaN)).toThrow(RangeError);
    expect(() => toPaisa(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('rejects amounts beyond safe integer paisa', () => {
    expect(() => toPaisa('99999999999999999')).toThrow(/too large/);
  });
});

describe('sumPaisa / toTaka', () => {
  it('sums exactly without float drift', () => {
    const items = ['0.1', '0.2', '0.3'].map((v) => toPaisa(v));
    expect(sumPaisa(items)).toBe(60);
    expect(toTaka(sumPaisa(items))).toBe(0.6);
  });

  it('sums an empty list to zero', () => {
    expect(sumPaisa([])).toBe(0);
  });
});

describe('formatTaka', () => {
  it('drops decimals for whole taka and groups thousands', () => {
    expect(formatTaka(toPaisa('21413'))).toBe('৳21,413');
  });

  it('keeps meaningful decimals', () => {
    expect(formatTaka(toPaisa('162.5'))).toBe('৳162.5');
    expect(formatTaka(toPaisa('61.25'))).toBe('৳61.25');
  });

  it('uses a true minus sign for negatives', () => {
    expect(formatTaka(toPaisa('-373'))).toBe('−৳373');
  });

  it('honours an explicit decimal count', () => {
    expect(formatTaka(toPaisa('92.5'), { decimals: 2 })).toBe('৳92.50');
  });
});
