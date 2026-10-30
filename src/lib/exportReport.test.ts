import { describe, expect, it } from 'vitest';
import { computeReport } from './calc';
import { october2026 } from './calc/__fixtures__/october-2026';
import { reportCsv } from './exportReport';

describe('reportCsv', () => {
  const csv = reportCsv(computeReport(october2026));
  const lines = csv.trim().split('\r\n');

  it('has a header and one row per member', () => {
    expect(lines[0]?.startsWith('Member,Meals,Bazar,Meal Cost,Have to Pay')).toBe(true);
    expect(lines.filter((l) => /^(Ayman|Saad|Alif|Asif),/.test(l))).toHaveLength(4);
  });

  it('writes the sheet-compatible final and settled values', () => {
    const ayman = lines.find((l) => l.startsWith('Ayman,'))?.split(',') ?? [];
    const header = lines[0]?.split(',') ?? [];
    expect(ayman[header.indexOf('Final')]).toBe('5426');
    expect(ayman[header.indexOf('Initial')]).toBe('-53.75');
    expect(csv).toContain('Sum final (sheet-compatible),21413');
    expect(csv).toContain('Sum settled,21410');
  });
});
