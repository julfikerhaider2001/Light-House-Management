import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { dayOf, parseItems, parseWorkbook } from './importSheet';

function workbook(tabs: Record<string, (string | number | null)[][]>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(tabs)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return wb;
}

describe('parseWorkbook', () => {
  const wb = workbook({
    'Meal Count': [
      ['October 2026'],
      ['Date', 'Ayman', 'Saad', 'Alif', 'Asif'],
      ['1 Oct', 1, 1.5, 1, 2],
      ['2 Oct', 1, 1, 0.5, 1.5],
      ['Total', 2, 2.5, 1.5, 3.5],
    ],
    'Meal Expense': [
      ['Date', 'Ayman', 'Saad', 'Alif', 'Asif'],
      ['2026-10-01', null, 320, null, null],
      ['2026-10-02', 410, null, null, 340],
    ],
    // Different column order on purpose: must map by name.
    'Initial Expense': [
      ['Date', 'Saad', 'Ayman', 'Alif', 'Asif'],
      [1, 130, 115, null, null],
    ],
    'Total Expenses': [
      ['Khala', 4500],
      ['House Rent', 15500],
      ['Wifi', 650],
      ['Gas', 460],
      ['Extra', 300],
    ],
  });
  // Cell note on Saad's bazar: "murgi-230, chal+milk-90".
  const note = wb.Sheets['Meal Expense']?.C2 as XLSX.CellObject | undefined;
  if (note) note.c = [{ a: 'Saad', t: 'murgi-230, chal+milk-90' }];

  const parsed = parseWorkbook(wb, XLSX.utils);

  it('reads members and meals, skipping title and total rows', () => {
    expect(parsed.members).toEqual(['Ayman', 'Saad', 'Alif', 'Asif']);
    expect(parsed.meals).toHaveLength(8);
    expect(parsed.meals.find((m) => m.name === 'Saad' && m.day === 1)?.meals).toBe(1.5);
  });

  it('reads bazar trips with itemised notes', () => {
    const saad = parsed.expenses.find((e) => e.name === 'Saad' && e.kind === 'bazar');
    expect(saad).toEqual({
      name: 'Saad',
      day: 1,
      amount: 320,
      kind: 'bazar',
      items: [
        { name: 'murgi', amount: 230 },
        { name: 'chal+milk', amount: 90 },
      ],
    });
    expect(parsed.expenses.filter((e) => e.kind === 'bazar')).toHaveLength(3);
  });

  it('maps initial expenses by name, not column position', () => {
    const initial = parsed.expenses.filter((e) => e.kind === 'initial');
    expect(initial.find((e) => e.name === 'Saad')?.amount).toBe(130);
    expect(initial.find((e) => e.name === 'Ayman')?.amount).toBe(115);
  });

  it('reads bills from label/value pairs', () => {
    expect(parsed.bills).toEqual([
      { kind: 'khala', amount: 4500 },
      { kind: 'house_rent', amount: 15500 },
      { kind: 'wifi', amount: 650 },
      { kind: 'gas', amount: 460 },
      { kind: 'extra', amount: 300 },
    ]);
    expect(parsed.warnings).toEqual([]);
  });

  it('warns about bad meal values and notes that do not add up', () => {
    const bad = workbook({
      'Meal Count': [
        ['Date', 'A', 'B'],
        [1, 0.3, 1],
      ],
      'Meal Expense': [
        ['Date', 'A', 'B'],
        [1, 100, null],
      ],
    });
    const cell = bad.Sheets['Meal Expense']?.B2 as XLSX.CellObject | undefined;
    if (cell) cell.c = [{ a: 'x', t: 'dal-50' }];
    const p = parseWorkbook(bad, XLSX.utils);
    expect(p.meals).toEqual([{ name: 'B', day: 1, meals: 1 }]);
    expect(p.expenses[0]?.items).toEqual([]);
    expect(p.warnings).toHaveLength(2);
  });

  it('warns when there is no meal tab', () => {
    expect(parseWorkbook(workbook({ Other: [['x']] }), XLSX.utils).warnings[0]).toMatch(
      /Meal Count/,
    );
  });
});

describe('dayOf', () => {
  it.each([
    ['2026-10-26', 26],
    ['26 Oct', 26],
    ['26-Oct', 26],
    ['Oct 26', 26],
    ['26/10/2026', 26],
    ['7', 7],
  ])('reads %s', (text, day) => {
    expect(dayOf({ t: 's', v: text })).toBe(day);
  });

  it('reads numbers, Excel serials and Date values', () => {
    expect(dayOf({ t: 'n', v: 12 })).toBe(12);
    expect(dayOf({ t: 'n', v: 46321 })).toBe(26); // 2026-10-26
    expect(dayOf({ t: 'd', v: new Date(Date.UTC(2026, 9, 3)) })).toBe(3);
    expect(dayOf({ t: 's', v: 'Total' })).toBeNull();
    expect(dayOf(undefined)).toBeNull();
    expect(dayOf({ t: 'n', v: 45.5 })).toBeNull();
  });
});

describe('parseItems', () => {
  it('splits sheet-style notes', () => {
    expect(parseItems('murgi-230\nchal+milk - 90; dim: 120')).toEqual([
      { name: 'murgi', amount: 230 },
      { name: 'chal+milk', amount: 90 },
      { name: 'dim', amount: 120 },
    ]);
  });
});
