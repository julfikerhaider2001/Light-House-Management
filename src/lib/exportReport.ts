import type { Report } from './calc';
import type { Fraction } from './calc/fraction';

const COLUMNS: [string, (r: Report['members'][number]) => Fraction][] = [
  ['Meals', (r) => r.meals],
  ['Bazar', (r) => r.bazar],
  ['Meal Cost', (r) => r.mealCost],
  ['Have to Pay', (r) => r.haveToPay],
  ['Khala', (r) => r.khala],
  ['Rent', (r) => r.rent],
  ['Wifi', (r) => r.wifi],
  ['Gas', (r) => r.gas],
  ['Electricity', (r) => r.electricity],
  ['Other', (r) => r.other],
  ['Initial', (r) => r.initialDue],
  ['Previous Due', (r) => r.previousDue],
  ['Total', (r) => r.total],
  ['Extra', (r) => r.extra],
  ['Final', (r) => r.final],
  ['Settled', (r) => r.settled],
  ['Adjustment', (r) => r.adjustment],
  ['Paid', (r) => r.paid],
  ['Balance', (r) => r.balance],
];

const cell = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** The month report as CSV, one row per member plus a totals row. */
export function reportCsv(report: Report): string {
  const header = ['Member', ...COLUMNS.map(([name]) => name)];
  const rows = report.members.map((r) => [
    r.name,
    ...COLUMNS.map(([, pick]) => pick(r).toFixed(2).replace(/\.00$/, '')),
  ]);
  const o = report.overview;
  const s = report.settlement;
  const summary = [
    [],
    ['Meal rate', o.mealRate.toFixed(4)],
    ['Total meals', o.totalMeals.toFixed(1)],
    ['Total bazar', o.totalBazar.toFixed(2)],
    ['Khala count', String(o.khalaCount)],
    ['Sum final (sheet-compatible)', s.sumFinal.toFixed(2)],
    ['Sum settled', s.sumSettled.toFixed(2)],
    ['Rounding error', s.error.toFixed(2)],
  ];
  return [header, ...rows, ...summary].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  // BOM so Excel opens ৳ and Bangla names as UTF-8.
  const blob = new Blob(['﻿', text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
