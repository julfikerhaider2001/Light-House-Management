import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Stepper } from '../components/Stepper';
import { Card, Eyebrow, Money, PageHeader, Spinner, StatusPill } from '../components/ui';
import { useToast } from '../components/toast-context';
import { t } from '../i18n';
import { mealsFor, periodMembers, useBundle, useReport, useSetMeal } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import { useAvatarUrls } from '../lib/api/profile';
import { mealCount, taka } from '../lib/format';
import { useNow } from '../lib/useNow';
import {
  addDays,
  formatCountdown,
  formatDay,
  formatMonth,
  mealDeadline,
  todayIn,
} from '../lib/time';

export default function TodayPage() {
  const { messId, memberId } = useCurrentMess();
  const bundle = useBundle(messId);
  const report = useReport(bundle.data);
  const setMeal = useSetMeal(messId);
  const toast = useToast();
  const now = useNow();
  const photos = useAvatarUrls(bundle.data);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b) {
    return (
      <>
        <PageHeader eyebrow={t('app.name').toUpperCase()} title={t('today.title')} />
        <Card>
          <p className="muted">{t('today.noPeriod')}</p>
        </Card>
      </>
    );
  }

  const tz = b.mess.timezone;
  const cutoff = b.mess.meal_cutoff_time;
  const today = todayIn(tz, new Date(now));
  // Members plan tomorrow's meals; the cutoff the night before is a reminder.
  const target = addDays(today, 1);
  const deadline = mealDeadline(target, cutoff, tz).getTime();
  // The cutoff is a reminder: anyone can still change any day while the month is open.
  const pastCutoff = now >= deadline;
  const meRow = report?.members.find((m) => m.memberId === memberId);
  const rate = report?.overview.mealRate.toNumber() ?? 0;
  const inMonth = target.slice(0, 7) === b.period.month.slice(0, 7);

  const change = (member: string, value: number) => {
    setMeal.mutate(
      { memberId: member, date: target, meals: value },
      { onError: (err) => toast.show(err.message || t('errors.generic'), { tone: 'error' }) },
    );
  };

  const members = periodMembers(b).filter((m) => m.status === 'active');
  const total = members.reduce((s, m) => s + mealsFor(b, m.id, target), 0);

  const due = meRow ? meRow.balance.toNumber() : 0;
  const oldDue = meRow ? meRow.previousBalance.toNumber() : 0;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__top">
          <div className="stack-tight">
            <Eyebrow>{formatDay(today).toUpperCase()}</Eyebrow>
            <h1 id="hero-title">{t('today.title')}</h1>
          </div>
          <StatusPill tone={b.period.status === 'open' ? 'ok' : 'idle'}>
            {`${formatMonth(b.period.month).slice(0, 3).toUpperCase()} · ${
              b.period.status === 'open' ? t('common.open') : t('common.closed')
            }`}
          </StatusPill>
        </div>
        <div className="highlight-grid" data-testid="today-highlights">
          <div className="highlight highlight--accent">
            <Eyebrow>{t('today.mealRate')}</Eyebrow>
            <span className="highlight__value mono" data-testid="today-meal-rate">
              {taka(rate, 2)}
            </span>
            <span className="highlight__sub small muted">
              {t('today.rateSub', { meals: mealCount(report?.overview.totalMeals ?? 0) })}
            </span>
          </div>
          <div className="highlight highlight--info">
            <Eyebrow>{t('today.myMeals')}</Eyebrow>
            <span className="highlight__value mono">{mealCount(meRow?.meals.toNumber() ?? 0)}</span>
            <span className="highlight__sub small muted">
              {t('today.mealCostSub', { cost: taka(meRow?.mealCost ?? 0, 0) })}
            </span>
          </div>
          <Link to="/report" className="highlight highlight--warn highlight--link">
            <Eyebrow>{t('today.toPay')}</Eyebrow>
            {meRow ? <Money className="highlight__value" value={meRow.settled} max={0} /> : '—'}
            <span className="highlight__sub small muted">{t('today.toPaySub')}</span>
          </Link>
          <Link
            to="/payments"
            data-testid="today-due"
            className={`highlight highlight--link ${due > 0 ? 'highlight--due' : 'highlight--accent'}`}
          >
            <Eyebrow>{t('today.due')}</Eyebrow>
            <Money className="highlight__value" value={Math.max(due, 0)} max={0} />
            <span className="highlight__sub small muted">
              {due > 0
                ? t('today.dueSub', { paid: taka(meRow?.paid ?? 0, 0) })
                : due < 0
                  ? t('today.extraPaid', { amount: taka(-due, 0) })
                  : t('today.allClear')}
            </span>
          </Link>
        </div>
        {oldDue !== 0 ? (
          <Link to="/report" className={`notice ${oldDue > 0 ? 'notice--due' : 'notice--info'}`}>
            <span>{oldDue > 0 ? t('today.oldDue') : t('today.oldCredit')}</span>
            <span className="mono notice__aside">{taka(Math.abs(oldDue), 0)}</span>
          </Link>
        ) : null}
      </section>

      {members.length > 0 ? (
        <Card aria-labelledby="grid-title">
          <div className="row-between">
            <h2 id="grid-title" className="h3">
              {t('today.everyone', { date: formatDay(target) })}
            </h2>
            <span className="row">
              <span className="tag tag--info">{t('common.manager')}</span>
              <span className="mono muted">Σ {mealCount(total)}</span>
            </span>
          </div>
          <div className={`notice ${pastCutoff ? 'notice--info' : 'notice--warn'}`}>
            <span>
              {pastCutoff
                ? t('today.pastCutoff', { time: cutoff.slice(0, 5) })
                : t('today.locksAt', { time: cutoff.slice(0, 5) })}
            </span>
            {!pastCutoff ? (
              <span className="mono notice__aside">{formatCountdown(deadline - now)}</span>
            ) : null}
          </div>
          <ul className="list" role="list">
            {members.map((m) => (
              <li key={m.id} className="list-row">
                <Avatar name={m.display_name} url={m.user_id ? photos.get(m.user_id) : undefined} />
                <span className="list-row__name">
                  {m.display_name}
                  {m.id === memberId ? <span className="tag">{t('common.you')}</span> : null}
                </span>
                <Stepper
                  value={mealsFor(b, m.id, target)}
                  disabled={!inMonth}
                  decLabel={t('today.decFor', { name: m.display_name })}
                  incLabel={t('today.incFor', { name: m.display_name })}
                  onChange={(v) => change(m.id, v)}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
