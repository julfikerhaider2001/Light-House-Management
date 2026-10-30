import { mealCount, taka } from './format';
import { formatDay, formatMonth } from './time';

export interface ActivityRow {
  action: string;
  entity: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface FormattedActivity {
  tag: 'MEAL' | 'BAZAR' | 'INITIAL' | 'BILL' | 'RENT' | 'DUE' | 'PAY' | 'MEMBER' | 'MONTH' | 'MESS';
  tone: 'ok' | 'info' | 'warn' | 'due' | 'idle';
  message: string;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** "MEAL Asif +1.5 (26 Oct)", "BAZAR Saad ৳230 murgi", … */
export function formatActivity(
  row: ActivityRow,
  nameOf: (id: string) => string,
): FormattedActivity {
  const next = (row.payload.new ?? {}) as Row;
  const prev = (row.payload.old ?? {}) as Row;
  const data = Object.keys(next).length ? next : prev;
  const who = nameOf(str(data.member_id));
  const removed = row.action === 'delete';
  const restored = row.action === 'restore';
  const suffix = removed ? ' removed' : restored ? ' restored' : '';

  switch (row.entity) {
    case 'meal_entries': {
      const day = formatDay(str(data.date)).split(' ').slice(1).join(' ');
      if (removed || restored)
        return { tag: 'MEAL', tone: 'ok', message: `${who}${suffix} (${day})` };
      const delta = num(next.meals) - (row.action === 'insert' ? 0 : num(prev.meals));
      const sign = delta >= 0 ? '+' : '−';
      return {
        tag: 'MEAL',
        tone: 'ok',
        message: `${who} ${sign}${mealCount(Math.abs(delta))} (${day})`,
      };
    }
    case 'expenses': {
      const items = Array.isArray(data.items)
        ? (data.items as Row[])
            .map((i) => str(i.name))
            .filter(Boolean)
            .join(', ')
        : '';
      return {
        tag: data.kind === 'initial' ? 'INITIAL' : 'BAZAR',
        tone: removed ? 'due' : 'ok',
        message: `${who} ${taka(num(data.amount))}${items ? ` ${items}` : ''}${suffix}`,
      };
    }
    case 'bills':
      return {
        tag: 'BILL',
        tone: 'info',
        message: `${str(data.label) || str(data.kind).replace('_', ' ')} ${taka(num(data.amount))}${suffix}`,
      };
    case 'rent_shares':
      return {
        tag: 'RENT',
        tone: 'info',
        message:
          data.fixed_amount === null
            ? `${who} splits rent`
            : `${who} fixed ${taka(num(data.fixed_amount))}`,
      };
    case 'previous_dues':
      return { tag: 'DUE', tone: 'warn', message: `${who} ${taka(num(data.amount))}` };
    case 'payments':
      return {
        tag: 'PAY',
        tone: removed ? 'due' : 'ok',
        message: `${who} ${taka(num(data.amount))} ${str(data.method)}${suffix}`,
      };
    case 'mess_members': {
      const name = str(data.display_name);
      if (row.action === 'insert') return { tag: 'MEMBER', tone: 'info', message: `${name} added` };
      if (!prev.user_id && next.user_id)
        return { tag: 'MEMBER', tone: 'info', message: `${name} joined` };
      if (next.status === 'left' && prev.status !== 'left')
        return { tag: 'MEMBER', tone: 'warn', message: `${name} left` };
      return { tag: 'MEMBER', tone: 'info', message: `${name} updated` };
    }
    case 'periods': {
      const rawMonth = str(data.month) || str(row.payload.month);
      const month = rawMonth ? formatMonth(rawMonth) : '';
      if (row.action === 'reopen') {
        return {
          tag: 'MONTH',
          tone: 'warn',
          message: `${month} reopened — ${str(row.payload.reason)}`,
        };
      }
      if (row.action === 'insert')
        return { tag: 'MONTH', tone: 'info', message: `${month} opened` };
      if (next.status === 'closed' && prev.status !== 'closed')
        return { tag: 'MONTH', tone: 'idle', message: `${month} closed` };
      return { tag: 'MONTH', tone: 'idle', message: `${month} updated` };
    }
    default:
      return {
        tag: 'MESS',
        tone: 'idle',
        message: `${str(data.name) || row.entity} ${row.action}`,
      };
  }
}

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function formatClock(iso: string): string {
  return clock.format(new Date(iso));
}
