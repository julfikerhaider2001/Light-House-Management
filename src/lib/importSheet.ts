// Parses the mess Google Sheet (.xlsx) into rows for one month. Layout-tolerant:
//  - "Meal Count":      a header row of member names; one row per day; meals per cell.
//  - "Meal Expense":    same grid; each number is a bazar trip by that member that day.
//                       Cell notes like "murgi-230, chal+milk-90" become itemised entries.
//  - "Initial Expense": same grid for initial costs. Column order differs from the other
//                       tabs (Saad before Ayman), so every tab is mapped by NAME.
//  - "Total Expenses":  label/value pairs (Khala, House Rent, Wifi, Gas, Electricity, Extra).
import type { CellObject, WorkBook, WorkSheet } from 'xlsx';
import type { BillKind } from './api/schemas';

export interface ParsedSheet {
  members: string[];
  meals: { name: string; day: number; meals: number }[];
  expenses: {
    name: string;
    day: number;
    amount: number;
    kind: 'bazar' | 'initial';
    items: { name: string; amount: number }[];
  }[];
  bills: { kind: BillKind; amount: number }[];
  warnings: string[];
}

type Utils = typeof import('xlsx').utils;

const TAB = {
  meals: /meal\s*count/i,
  bazar: /meal\s*expense|bazar/i,
  initial: /initial/i,
  totals: /total/i,
};

const BILL_LABELS: [RegExp, BillKind][] = [
  [/^khala/i, 'khala'],
  [/house\s*rent|^rent$/i, 'house_rent'],
  [/wi-?fi|internet/i, 'wifi'],
  [/^gas/i, 'gas'],
  [/electric|current\s*bill/i, 'electricity'],
  [/^extra/i, 'extra'],
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const SKIP_HEADER = /^(date|day|sl|no\.?|#|total|sum|meals?|amount)$/i;

/** Day of month from an Excel date, "2026-10-01", "1 Oct", "01-Oct" or a bare 1–31. */
export function dayOf(cell: CellObject | undefined): number | null {
  if (!cell) return null;
  if (cell.v instanceof Date) return cell.v.getUTCDate() || cell.v.getDate();
  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (cell.v >= 1 && cell.v <= 31 && Number.isInteger(cell.v)) return cell.v;
    if (cell.v > 20000) {
      // Excel serial date (1900 system).
      const d = new Date(Math.round((cell.v - 25569) * 86400 * 1000));
      return d.getUTCDate();
    }
    return null;
  }
  const s = String(cell.w ?? cell.v ?? '')
    .trim()
    .toLowerCase();
  let m = /^\d{4}-\d{2}-(\d{2})/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d{1,2})[\s\-/.]*([a-z]{3})/.exec(s);
  if (m && MONTHS.includes(m[2] ?? '')) return Number(m[1]);
  m = /^([a-z]{3})[a-z]*[\s\-/.]*(\d{1,2})\b/.exec(s);
  if (m && MONTHS.includes(m[1] ?? '')) return Number(m[2]);
  m = /^(\d{1,2})$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d{1,2})[/.](\d{1,2})[/.]\d{2,4}$/.exec(s);
  if (m) return Number(m[1]);
  return null;
}

const num = (cell: CellObject | undefined): number | null => {
  if (!cell) return null;
  if (typeof cell.v === 'number') return cell.v;
  const s = String(cell.v ?? '').replace(/[৳,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

/** "murgi-230, chal+milk-90" → items (only used when they sum to the cell amount). */
export function parseItems(note: string): { name: string; amount: number }[] {
  const items: { name: string; amount: number }[] = [];
  for (const m of note.matchAll(/([^,\n;]+?)\s*[-–:=]\s*(\d+(?:\.\d{1,2})?)/g)) {
    const name = (m[1] ?? '').trim();
    if (name) items.push({ name, amount: Number(m[2]) });
  }
  return items;
}

interface Grid {
  header: number;
  columns: { col: number; name: string }[];
}

/** Finds the header row: the first row with ≥2 cells that look like member names. */
function findGrid(ws: WorkSheet, utils: Utils, known: string[]): Grid | null {
  const ref = ws['!ref'];
  if (!ref) return null;
  const range = utils.decode_range(ref);
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 15); r++) {
    const columns: Grid['columns'] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[utils.encode_cell({ r, c })] as CellObject | undefined;
      const text = typeof cell?.v === 'string' ? cell.v.trim() : '';
      if (!text || SKIP_HEADER.test(text) || dayOf(cell) !== null) continue;
      if (known.length === 0 || known.some((k) => k.toLowerCase() === text.toLowerCase())) {
        columns.push({ col: c, name: text });
      }
    }
    if (columns.length >= 2) return { header: r, columns };
  }
  return null;
}

function gridRows(
  ws: WorkSheet,
  utils: Utils,
  grid: Grid,
  onCell: (name: string, day: number, cell: CellObject) => void,
) {
  const range = utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = grid.header + 1; r <= range.e.r; r++) {
    let day: number | null = null;
    for (let c = range.s.c; c < (grid.columns[0]?.col ?? 0) && day === null; c++) {
      day = dayOf(ws[utils.encode_cell({ r, c })] as CellObject | undefined);
    }
    if (day === null || day < 1 || day > 31) continue;
    for (const { col, name } of grid.columns) {
      const cell = ws[utils.encode_cell({ r, c: col })] as CellObject | undefined;
      if (cell) onCell(name, day, cell);
    }
  }
}

export function parseWorkbook(wb: WorkBook, utils: Utils): ParsedSheet {
  const out: ParsedSheet = { members: [], meals: [], expenses: [], bills: [], warnings: [] };
  const sheet = (re: RegExp, except?: RegExp) => {
    const name = wb.SheetNames.find((n) => re.test(n) && !(except && except.test(n)));
    return name ? wb.Sheets[name] : undefined;
  };

  const mealWs = sheet(TAB.meals);
  const mealGrid = mealWs ? findGrid(mealWs, utils, []) : null;
  if (mealWs && mealGrid) {
    out.members = mealGrid.columns.map((c) => c.name);
    gridRows(mealWs, utils, mealGrid, (name, day, cell) => {
      const v = num(cell);
      if (v === null) return;
      if (v < 0 || Math.round(v * 2) !== v * 2) {
        out.warnings.push(`Meal Count: ${name} day ${day} has ${v}; meals must be in 0.5 steps`);
        return;
      }
      out.meals.push({ name, day, meals: v });
    });
  } else {
    out.warnings.push('No "Meal Count" tab with member names found');
  }

  const expenseTab = (ws: WorkSheet | undefined, kind: 'bazar' | 'initial', label: string) => {
    if (!ws) return;
    const grid = findGrid(ws, utils, out.members);
    if (!grid) {
      out.warnings.push(`${label}: no header row with member names`);
      return;
    }
    gridRows(ws, utils, grid, (name, day, cell) => {
      const amount = num(cell);
      if (amount === null || amount === 0) return;
      const note = cell.c?.map((c) => c.t).join('\n') ?? '';
      let items = note ? parseItems(note) : [];
      const sum = items.reduce((s, i) => s + i.amount, 0);
      if (items.length && Math.abs(sum - amount) > 0.001) {
        out.warnings.push(
          `${label}: ${name} day ${day} note adds up to ${sum}, not ${amount}; imported without items`,
        );
        items = [];
      }
      out.expenses.push({ name, day, amount, kind, items });
    });
  };
  expenseTab(sheet(TAB.bazar), 'bazar', 'Meal Expense');
  expenseTab(sheet(TAB.initial), 'initial', 'Initial Expense');

  const totals = sheet(TAB.totals);
  if (totals?.['!ref']) {
    const range = utils.decode_range(totals['!ref']);
    const seen = new Set<BillKind>();
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = totals[utils.encode_cell({ r, c })] as CellObject | undefined;
        if (typeof cell?.v !== 'string') continue;
        const match = BILL_LABELS.find(([re]) => re.test(cell.v as string));
        if (!match || seen.has(match[1])) continue;
        // The amount is the first number to the right, or directly below.
        const right = [1, 2, 3].map((d) =>
          num(totals[utils.encode_cell({ r, c: c + d })] as CellObject),
        );
        const below = num(totals[utils.encode_cell({ r: r + 1, c })] as CellObject);
        const amount = right.find((v) => v !== null) ?? below;
        if (amount !== null && amount !== undefined) {
          seen.add(match[1]);
          out.bills.push({ kind: match[1], amount });
        }
      }
    }
  }

  return out;
}
