import { useState } from 'react';
import { Check } from 'lucide-react';
import { ActivityLog } from '../components/ActivityLog';
import { useToast } from '../components/toast-context';
import { Button, Card, Field, PageHeader, Spinner, StatusPill } from '../components/ui';
import { t } from '../i18n';
import { useBundle, useReport } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import { closePeriod, reopenPeriod, useMessMutation } from '../lib/api/writes';
import { mealCount, taka } from '../lib/format';
import { haptic } from '../lib/native';
import { addDays, formatMonth, monthDays } from '../lib/time';

interface Step {
  key: string;
  title: string;
  detail: string;
  done: boolean;
}

export default function ClosePage() {
  const { messId, isManager } = useCurrentMess();
  const bundle = useBundle(messId);
  const report = useReport(bundle.data);
  const close = useMessMutation(messId, closePeriod);
  const reopen = useMessMutation(messId, reopenPeriod);
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b || !report) return <PageHeader eyebrow="" title={t('close.title')} />;

  const month = formatMonth(b.period.month);
  const nextMonth = formatMonth(addDays(monthDays(b.period.month).at(-1) ?? b.period.month, 1));
  const o = report.overview;
  const bazar = b.expenses.filter((e) => e.kind === 'bazar');
  const billsSet = ['khala', 'house_rent'].every((k) => b.bills.some((x) => x.kind === k));
  const closed = b.period.status === 'closed';

  const steps: Step[] = [
    {
      key: 'meals',
      title: t('close.meals'),
      detail: t('close.mealsDetail', { days: o.khalaCount, count: mealCount(o.totalMeals) }),
      done: o.khalaCount > 0,
    },
    {
      key: 'bazar',
      title: t('close.bazar'),
      detail: t('close.bazarDetail', { count: bazar.length, amount: taka(o.totalBazar, 0) }),
      done: bazar.length > 0,
    },
    {
      key: 'bills',
      title: t('close.bills'),
      detail: billsSet ? t('close.billsDetail') : t('close.billsMissing'),
      done: billsSet,
    },
    {
      key: 'review',
      title: t('close.review'),
      detail: t('close.reviewDetail', {
        amount: taka(report.settlement.sumSettled, 0),
        next: nextMonth,
      }),
      done: closed,
    },
    {
      key: 'closed',
      title: t('close.closed'),
      detail:
        closed && b.period.closed_at
          ? t('close.closedDetail', { date: b.period.closed_at.slice(0, 10) })
          : '',
      done: closed,
    },
  ];
  const ready = steps.slice(0, 3).every((s) => s.done);
  // The first unfinished step is "current".
  const current = steps.findIndex((s) => !s.done);

  const doClose = () =>
    close.mutate(
      {
        periodId: b.period.id,
        snapshot: JSON.parse(JSON.stringify({ month: b.period.month, report })) as Record<
          string,
          unknown
        >,
        carry: report.members.map((m) => ({
          member_id: m.memberId,
          amount: Number(m.balance.toFixed(2)),
        })),
      },
      {
        onSuccess: () => {
          haptic('success');
          toast.show(t('close.done', { month }));
        },
        onError: (err) => toast.show(err.message, { tone: 'error' }),
      },
    );

  const reasonError = reason.trim().length < 3 ? t('close.reasonShort') : undefined;
  const doReopen = () => {
    setReasonTouched(true);
    if (reasonError) return;
    reopen.mutate(
      { periodId: b.period.id, reason: reason.trim() },
      {
        onSuccess: () => {
          setReason('');
          toast.show(t('close.reopened', { month }));
        },
        onError: (err) => toast.show(err.message, { tone: 'error' }),
      },
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={month.toUpperCase()}
        title={t('close.title')}
        aside={
          <StatusPill tone={closed ? 'idle' : 'ok'}>
            {closed ? t('common.closed') : t('common.open')}
          </StatusPill>
        }
      />

      <ol className="steps" aria-label={t('close.title')}>
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`step glass${s.done ? ' step--done' : ''}${i === current ? ' step--current' : ''}`}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="step__mark" aria-hidden="true">
              {s.done ? <Check size={14} strokeWidth={2} /> : <span className="mono">{i + 1}</span>}
            </span>
            <div className="stack-tight">
              <strong>{s.title}</strong>
              {s.detail ? <span className="muted small mono">{s.detail}</span> : null}
            </div>
            {s.key === 'review' && !closed ? (
              isManager ? (
                <Button
                  variant="primary"
                  className="step__action"
                  disabled={!ready || close.isPending}
                  onClick={doClose}
                >
                  {t('close.closeButton', { month })}
                </Button>
              ) : (
                <span className="muted small step__action">{t('close.managerOnly')}</span>
              )
            ) : null}
          </li>
        ))}
      </ol>

      {closed && isManager ? (
        <Card aria-labelledby="reopen-title">
          <h2 id="reopen-title" className="h3">
            {t('close.reopenTitle')}
          </h2>
          <Field
            id="reopen-reason"
            label={t('close.reason')}
            hint={t('close.reasonHint')}
            error={reasonTouched ? reasonError : undefined}
          >
            <input
              id="reopen-reason"
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setReasonTouched(true)}
            />
          </Field>
          <Button variant="danger" disabled={reopen.isPending} onClick={doReopen}>
            {t('close.reopen', { month })}
          </Button>
        </Card>
      ) : null}

      <Card className="log-card" aria-label={t('activity.title')}>
        <ActivityLog messId={messId} limit={30} />
      </Card>
    </>
  );
}
