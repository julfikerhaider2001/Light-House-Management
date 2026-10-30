import { describe, expect, it } from 'vitest';
import { formatActivity, formatClock, type ActivityRow } from './activityFormat';

const names: Record<string, string> = { a: 'Asif', s: 'Saad' };
const nameOf = (id: string) => names[id] ?? '?';
const row = (entity: string, action: string, payload: ActivityRow['payload']): ActivityRow => ({
  entity,
  action,
  payload,
  created_at: '2026-10-26T10:00:00Z',
});

describe('formatActivity', () => {
  it('describes meal changes as deltas', () => {
    expect(
      formatActivity(
        row('meal_entries', 'update', {
          new: { member_id: 'a', date: '2026-10-26', meals: 2.5 },
          old: { member_id: 'a', date: '2026-10-26', meals: 1 },
        }),
        nameOf,
      ),
    ).toEqual({ tag: 'MEAL', tone: 'ok', message: 'Asif +1.5 (26 Oct)' });
    expect(
      formatActivity(
        row('meal_entries', 'insert', { new: { member_id: 'a', date: '2026-10-02', meals: 2 } }),
        nameOf,
      ).message,
    ).toBe('Asif +2 (2 Oct)');
  });

  it('describes bazar with items', () => {
    const f = formatActivity(
      row('expenses', 'insert', {
        new: {
          member_id: 's',
          amount: 230,
          kind: 'bazar',
          items: [{ name: 'murgi', amount: 230 }],
        },
      }),
      nameOf,
    );
    expect(f).toEqual({ tag: 'BAZAR', tone: 'ok', message: 'Saad ৳230 murgi' });
  });

  it('marks soft deletes and reopen reasons', () => {
    expect(
      formatActivity(
        row('payments', 'delete', { new: { member_id: 's', amount: 500, method: 'bkash' } }),
        nameOf,
      ).message,
    ).toBe('Saad ৳500 bkash removed');
    expect(
      formatActivity(row('periods', 'reopen', { month: '2026-10-01', reason: 'typo' }), nameOf),
    ).toEqual({ tag: 'MONTH', tone: 'warn', message: 'October 2026 reopened — typo' });
  });

  it('formats times in Dhaka', () => {
    expect(formatClock('2026-10-26T10:00:05Z')).toBe('16:00:05');
  });
});
