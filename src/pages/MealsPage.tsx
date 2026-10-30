import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { Card, PageHeader, Spinner, StatusPill } from '../components/ui';
import { useToast } from '../components/toast-context';
import { t } from '../i18n';
import { mealsFor, periodMembers, useBundle, useSetMeal } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import { mealCount } from '../lib/format';
import { useNow } from '../lib/useNow';
import { formatDay, formatMonth, mealDeadline, monthDays, todayIn } from '../lib/time';

export default function MealsPage() {
  const { messId, memberId, isManager } = useCurrentMess();
  const bundle = useBundle(messId);
  const setMeal = useSetMeal(messId);
  const toast = useToast();
  const now = useNow(30_000);
  const [editing, setEditing] = useState<{ memberId: string; date: string } | null>(null);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b) return <PageHeader eyebrow="" title={t('meals.title')} />;

  const members = periodMembers(b);
  const days = monthDays(b.period.month);
  const today = todayIn(b.mess.timezone);
  const open = b.period.status === 'open';
  const canEdit = (member: string, date: string) =>
    open &&
    (isManager ||
      (member === memberId &&
        now < mealDeadline(date, b.mess.meal_cutoff_time, b.mess.timezone).getTime()));

  const dayTotal = (date: string) => members.reduce((s, m) => s + mealsFor(b, m.id, date), 0);
  const memberTotal = (id: string) =>
    b.meals.filter((m) => m.member_id === id).reduce((s, m) => s + m.meals, 0);
  const grand = members.reduce((s, m) => s + memberTotal(m.id), 0);
  const editMember = members.find((m) => m.id === editing?.memberId);

  return (
    <>
      <PageHeader
        eyebrow={formatMonth(b.period.month).toUpperCase()}
        title={t('meals.title')}
        aside={
          <StatusPill tone={open ? 'ok' : 'idle'}>
            {open ? t('common.open') : t('common.closed')}
          </StatusPill>
        }
      />
      <Card className="grid-card">
        <p className="muted small">{t('meals.hint')}</p>
        <div className="grid-scroll" tabIndex={0} aria-label={t('meals.title')}>
          <table className="grid mono">
            <thead>
              <tr>
                <th scope="col" className="sticky">
                  {t('meals.date')}
                </th>
                {members.map((m) => (
                  <th key={m.id} scope="col">
                    {m.display_name}
                  </th>
                ))}
                <th scope="col">Σ</th>
              </tr>
            </thead>
            <tbody>
              {days.map((date) => (
                <tr key={date} className={date === today ? 'is-today' : undefined}>
                  <th scope="row" className="sticky">
                    {formatDay(date)}
                  </th>
                  {members.map((m) => {
                    const v = mealsFor(b, m.id, date);
                    const editable = canEdit(m.id, date);
                    return (
                      <td key={m.id}>
                        <button
                          type="button"
                          className={`cell${v === 0 ? ' cell--zero' : ''}`}
                          disabled={!editable}
                          aria-label={`${m.display_name}, ${formatDay(date)}: ${mealCount(v)}`}
                          onClick={() => setEditing({ memberId: m.id, date })}
                        >
                          {mealCount(v)}
                        </button>
                      </td>
                    );
                  })}
                  <td className="muted">{mealCount(dayTotal(date))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="sticky">
                  {t('meals.totals')}
                </th>
                {members.map((m) => (
                  <td key={m.id}>{mealCount(memberTotal(m.id))}</td>
                ))}
                <td>{mealCount(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Sheet
        open={editing !== null && editMember !== undefined}
        title={
          editing && editMember
            ? t('meals.editFor', { name: editMember.display_name, date: formatDay(editing.date) })
            : ''
        }
        onClose={() => setEditing(null)}
      >
        {editing && editMember ? (
          <div className="sheet-stepper">
            <Stepper
              size="lg"
              value={mealsFor(b, editing.memberId, editing.date)}
              decLabel={t('today.decFor', { name: editMember.display_name })}
              incLabel={t('today.incFor', { name: editMember.display_name })}
              onChange={(v) =>
                setMeal.mutate(
                  { ...editing, meals: v },
                  {
                    onError: (err) =>
                      toast.show(err.message || t('errors.generic'), { tone: 'error' }),
                  },
                )
              }
            />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
