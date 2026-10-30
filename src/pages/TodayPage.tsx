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

const QUICK = [0, 1, 1.5, 2, 3];

export default function TodayPage() {
  const { messId, memberId, isManager } = useCurrentMess();
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
  // Today's meals locked at last night's cutoff, so members plan for tomorrow.
  const target = addDays(today, 1);
  const deadline = mealDeadline(target, cutoff, tz).getTime();
  const locked = now >= deadline && !isManager;
  const mine = mealsFor(b, memberId, target);
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

  return (
    <>
      <PageHeader
        eyebrow={`${b.mess.name.toUpperCase()} · ${formatDay(today).toUpperCase()}`}
        title={t('today.title')}
        aside={
          <StatusPill tone={b.period.status === 'open' ? 'ok' : 'idle'}>
            {`${formatMonth(b.period.month).slice(0, 3).toUpperCase()} · ${
              b.period.status === 'open' ? t('common.open') : t('common.closed')
            }`}
          </StatusPill>
        }
      />

      <Card className="today-card" aria-labelledby="mine-title">
        <div className="row-between">
          <div className="stack-tight">
            <Eyebrow>{t('today.yourMeals', { date: formatDay(target).toUpperCase() })}</Eyebrow>
            <h2 id="mine-title" className="h3">
              {t('today.tomorrow')}
            </h2>
          </div>
          <span className={`mono sync ${setMeal.isPending ? 'sync--busy' : ''}`}>
            {setMeal.isPending ? t('common.saving') : t('common.saved')}
          </span>
        </div>
        <div className="today-stepper">
          <Stepper
            size="lg"
            testId="my-meals"
            value={mine}
            disabled={locked || !inMonth}
            decLabel={t('today.removeHalf')}
            incLabel={t('today.addHalf')}
            onChange={(v) => change(memberId, v)}
          />
          <span className="mono muted small">
            {t('today.approxCost', { cost: taka(Math.ceil(mine * rate), 0) })}
          </span>
        </div>
        <div className="quick" role="group" aria-label={t('today.quickSet')}>
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              className="quick__chip mono"
              aria-pressed={mine === q}
              disabled={locked || !inMonth}
              onClick={() => change(memberId, q)}
            >
              {mealCount(q)}
            </button>
          ))}
        </div>
        <div className={`notice ${locked ? 'notice--due' : 'notice--warn'}`}>
          <span>
            {locked ? t('today.locked') : t('today.locksAt', { time: cutoff.slice(0, 5) })}
          </span>
          {!locked ? (
            <span className="mono notice__aside">{formatCountdown(deadline - now)}</span>
          ) : null}
        </div>
      </Card>

      <div className="stat-row">
        <Card className="stat">
          <Eyebrow>{t('today.mealRate')}</Eyebrow>
          <span className="mono stat__value">{taka(rate, 2)}</span>
        </Card>
        <Card className="stat">
          <Eyebrow>{t('today.myMeals')}</Eyebrow>
          <span className="mono stat__value">{mealCount(meRow?.meals.toNumber() ?? 0)}</span>
        </Card>
        <Link to="/report" className="glass card stat stat--link">
          <Eyebrow>{t('today.toPay')}</Eyebrow>
          {meRow ? <Money className="stat__value" value={meRow.settled} max={0} /> : '—'}
        </Link>
      </div>

      {isManager ? (
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
