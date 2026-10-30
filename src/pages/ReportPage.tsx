import { Download, Printer } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button, Card, Eyebrow, Money, PageHeader, Spinner, StatusPill } from '../components/ui';
import { t, type MessageKey } from '../i18n';
import { useBundle, useReport } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import type { Fraction } from '../lib/calc/fraction';
import type { MemberReport } from '../lib/calc';
import { downloadText, reportCsv } from '../lib/exportReport';
import { mealCount, taka } from '../lib/format';
import { formatMonth } from '../lib/time';

const COLUMNS: [MessageKey, (r: MemberReport) => Fraction, boolean?][] = [
  ['report.bazar', (r) => r.bazar],
  ['report.mealCost', (r) => r.mealCost],
  ['report.haveToPay', (r) => r.haveToPay, true],
  ['report.khala', (r) => r.khala],
  ['report.rent', (r) => r.rent],
  ['report.wifi', (r) => r.wifi],
  ['report.gas', (r) => r.gas],
  ['report.electricity', (r) => r.electricity],
  ['report.other', (r) => r.other],
  ['report.initial', (r) => r.initialDue, true],
  ['report.previousDue', (r) => r.previousDue, true],
  ['report.total', (r) => r.total],
  ['report.extra', (r) => r.extra],
  ['report.final', (r) => r.final],
  ['report.settled', (r) => r.settled],
  ['report.adjustment', (r) => r.adjustment, true],
  ['report.paid', (r) => r.paid],
  ['report.balance', (r) => r.balance, true],
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export default function ReportPage() {
  const { messId } = useCurrentMess();
  const [params, setParams] = useSearchParams();
  const periodId = params.get('period') ?? undefined;
  const bundle = useBundle(messId, periodId);
  const report = useReport(bundle.data);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b || !report) return <PageHeader eyebrow="" title={t('report.title')} />;

  const o = report.overview;
  const s = report.settlement;
  // Optional columns only appear when the month has that bill.
  const visible = COLUMNS.filter(
    ([key]) =>
      (key !== 'report.electricity' || !report.bills.electricity.isZero()) &&
      (key !== 'report.other' || !report.bills.other.isZero()),
  );
  const leader = (l: typeof o.mostMeals, fmt: (v: Fraction) => string) =>
    l ? `${l.name} · ${fmt(l.value)}` : '—';

  const stats: [MessageKey, string, string?][] = [
    ['report.mealRate', taka(o.mealRate, 2), 'meal-rate'],
    ['report.bazarRate', taka(o.bazarRate, 2)],
    ['report.initialRate', taka(o.initialRate, 2)],
    ['report.totalMeals', mealCount(o.totalMeals)],
    ['report.totalMealCost', taka(o.totalMealCost, 0)],
    ['report.totalBazar', taka(o.totalBazar, 2)],
    ['report.totalInitial', taka(o.totalInitial, 2)],
    ['report.khalaCount', String(o.khalaCount)],
    ['report.mostMeals', leader(o.mostMeals, mealCount)],
    ['report.mostBazar', leader(o.mostBazar, (v) => taka(v, 0))],
    ['report.mostTrips', leader(o.mostBazarTrips, (v) => v.toFixed(0))],
    ['report.mostInitial', leader(o.mostInitial, (v) => taka(v, 0))],
    ['report.mostSpend', leader(o.mostTotalSpend, (v) => taka(v, 0))],
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${b.mess.name.toUpperCase()} · ${formatMonth(b.period.month).toUpperCase()}`}
        title={t('report.title')}
        aside={
          <StatusPill tone={b.period.status === 'open' ? 'ok' : 'idle'}>
            {b.period.status === 'open' ? t('common.open') : t('common.closed')}
          </StatusPill>
        }
      />

      <div className="toolbar no-print">
        {b.periods.length > 1 ? (
          <label className="row small">
            <span className="muted">{t('report.month')}</span>
            <select
              value={b.period.id}
              onChange={(e) => setParams(e.target.value ? { period: e.target.value } : {})}
            >
              {b.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatMonth(p.month)} · {p.status}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button
          onClick={() =>
            downloadText(`light-house-${b.period.month.slice(0, 7)}.csv`, reportCsv(report))
          }
        >
          <span className="row">
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('report.exportCsv')}
          </span>
        </Button>
        <Button onClick={() => window.print()}>
          <span className="row">
            <Printer size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('report.print')}
          </span>
        </Button>
      </div>

      <Card aria-labelledby="overview-title">
        <h2 id="overview-title" className="h3">
          {t('report.overview')}
        </h2>
        <dl className="stats-grid">
          {stats.map(([key, value, testId]) => (
            <div key={key}>
              <dt>
                <Eyebrow>{t(key)}</Eyebrow>
              </dt>
              <dd className="mono" data-testid={testId}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="grid-card" aria-labelledby="breakdown-title">
        <h2 id="breakdown-title" className="h3 pad-x">
          {t('report.breakdown')}
        </h2>
        <div className="grid-scroll" tabIndex={0} aria-labelledby="breakdown-title">
          <table className="grid report-table mono">
            <thead>
              <tr>
                <th scope="col" className="sticky">
                  {t('report.member')}
                </th>
                <th scope="col">{t('report.meals')}</th>
                {visible.map(([key]) => (
                  <th key={key} scope="col">
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.members.map((r) => (
                <tr key={r.memberId}>
                  <th scope="row" className="sticky">
                    <span className="row">
                      {r.name}
                      <StatusPill tone={r.balance.toNumber() > 0 ? 'due' : 'ok'}>
                        {r.balance.toNumber() > 0 ? t('common.due') : t('common.paid')}
                      </StatusPill>
                    </span>
                  </th>
                  <td>{mealCount(r.meals)}</td>
                  {visible.map(([key, pick, signed]) => (
                    <td key={key} data-testid={`${key.split('.')[1]}-${slug(r.name)}`}>
                      <Money value={pick(r)} signed={signed ?? false} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card aria-labelledby="settlement-title">
        <h2 id="settlement-title" className="h3">
          {t('report.settlement')}
        </h2>
        <p className="muted small">{t('report.settlementNote')}</p>
        <dl className="kv-list mono">
          <div>
            <dt>{t('report.target')}</dt>
            <dd>{taka(s.target)}</dd>
          </div>
          <div>
            <dt>{t('report.sumFinal')}</dt>
            <dd data-testid="sum-final">{taka(s.sumFinal)}</dd>
          </div>
          <div>
            <dt>{t('report.error')}</dt>
            <dd>
              {taka(s.error)} · {t('report.perError')} {taka(s.perError)}
            </dd>
          </div>
          <div>
            <dt>{t('report.sumSettled')}</dt>
            <dd data-testid="sum-settled">{taka(s.sumSettled)}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
