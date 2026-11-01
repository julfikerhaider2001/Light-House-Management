import { Download, Printer } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Button, Card, Money, PageHeader, Spinner, StatusPill, type Tone } from '../components/ui';
import { t, type MessageKey } from '../i18n';
import { useBundle, useReport } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import { Fraction } from '../lib/calc/fraction';
import { ROUND_UP_TO, type MemberReport, type Report } from '../lib/calc';
import { downloadText, reportCsv } from '../lib/exportReport';
import { mealCount, taka } from '../lib/format';
import { formatMonth } from '../lib/time';

/** Rows of the per-member table, in the order of the mess's Payment Summary. */
interface Line {
  key: string;
  label: MessageKey;
  pick: (r: MemberReport) => Fraction;
  signed?: boolean;
  /** Money with decimals (WiFi 162.50) rather than whole taka. */
  exact?: boolean;
  strong?: boolean;
  /** Only shown when the month has that bill. */
  bill?: 'electricity' | 'other';
}

const LINES: Line[] = [
  { key: 'meals', label: 'report.meals', pick: (r) => r.meals },
  { key: 'bazar', label: 'report.bazar', pick: (r) => r.bazar },
  { key: 'mealCost', label: 'report.mealCost', pick: (r) => r.mealCost },
  { key: 'haveToPay', label: 'report.haveToPay', pick: (r) => r.haveToPay, signed: true },
  { key: 'khala', label: 'report.khala', pick: (r) => r.khala },
  { key: 'rent', label: 'report.rent', pick: (r) => r.rent },
  { key: 'wifi', label: 'report.wifi', pick: (r) => r.wifi, exact: true },
  { key: 'gas', label: 'report.gas', pick: (r) => r.gas, exact: true },
  {
    key: 'electricity',
    label: 'report.electricity',
    pick: (r) => r.electricity,
    exact: true,
    bill: 'electricity',
  },
  { key: 'other', label: 'report.other', pick: (r) => r.other, exact: true, bill: 'other' },
  { key: 'initialPaid', label: 'report.initialPaid', pick: (r) => r.initialPaid },
  {
    key: 'initial',
    label: 'report.initial',
    pick: (r) => r.initialDue,
    signed: true,
    exact: true,
  },
  { key: 'total', label: 'report.total', pick: (r) => r.total, strong: true },
  { key: 'extra', label: 'report.extra', pick: (r) => r.extra, exact: true },
  { key: 'final', label: 'report.final', pick: (r) => r.final },
  { key: 'settled', label: 'report.settled', pick: (r) => r.settled, strong: true },
  { key: 'paid', label: 'report.paid', pick: (r) => r.paid },
  { key: 'balance', label: 'report.balance', pick: (r) => r.balance, signed: true, strong: true },
];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const n = (f: Fraction) => f.toNumber();

/** Taka without the ৳ sign, for the dense per-member table (headed "BDT", as in the format). */
function Bdt({
  value,
  signed = false,
  max = 0,
}: {
  value: Fraction;
  signed?: boolean;
  max?: number;
}) {
  const v = n(value);
  const tone = signed ? (v > 0 ? ' money--due' : v < 0 ? ' money--credit' : '') : '';
  return <span className={`money${tone}`}>{taka(v, max).replace('৳', '')}</span>;
}

/** This month's status for one member, from what they owe and what they paid. */
function monthStatus(r: MemberReport): { tone: Tone; label: MessageKey } {
  if (n(r.settled) <= 0) return { tone: 'info', label: 'report.getsBack' };
  if (n(r.balance) <= 0) return { tone: 'ok', label: 'report.statusPaid' };
  if (n(r.paid) > 0) return { tone: 'warn', label: 'report.statusPartly' };
  return { tone: 'due', label: 'report.statusUnpaid' };
}

function previousStatus(r: MemberReport): { tone: Tone; label: MessageKey } {
  const left = n(r.previousBalance);
  if (left > 0) return { tone: 'due', label: 'report.statusDue' };
  if (left < 0) return { tone: 'info', label: 'report.statusCredit' };
  return { tone: 'ok', label: 'report.statusClear' };
}

export default function ReportPage() {
  const { messId } = useCurrentMess();
  const [params, setParams] = useSearchParams();
  const periodId = params.get('period') ?? undefined;
  const bundle = useBundle(messId, periodId);
  const report = useReport(bundle.data);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b || !report) return <PageHeader eyebrow="" title={t('report.title')} />;

  const month = formatMonth(b.period.month);
  const open = b.period.status === 'open';
  const s = report.settlement;
  const lines = LINES.filter((l) => !l.bill || !report.bills[l.bill].isZero());
  const sum = (pick: (r: MemberReport) => Fraction) => Fraction.sum(report.members.map(pick));
  const previous = [...report.members, ...report.former];

  const paidCell = (r: MemberReport, value: Fraction, plain = false) => {
    const amount = plain ? <Bdt value={value} /> : <Money value={value} max={0} />;
    return open ? (
      <Link
        to={`/payments?member=${r.memberId}`}
        className="cell-link"
        aria-label={`${t('report.paid')} ${r.name}`}
      >
        {amount}
      </Link>
    ) : (
      amount
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={`${month.toUpperCase()} · ${t('report.paymentSummary').toUpperCase()}`}
        title={t('report.title')}
        aside={
          <StatusPill tone={open ? 'ok' : 'idle'}>
            {open ? t('common.open') : t('common.closed')}
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

      {/* 1. Settlement first: what each person pays this month. */}
      <Card className="summary-card summary-card--final" aria-labelledby="final-title">
        <div className="stack-tight">
          <h2 id="final-title" className="h3">
            {t('report.finalSummary')}
          </h2>
          <p className="muted small">{open ? t('report.paidHint') : t('report.finalHintClosed')}</p>
        </div>
        <table className="summary-table mono" data-testid="final-summary">
          <thead>
            <tr>
              <th scope="col">{t('report.member')}</th>
              <th scope="col">{t('report.amount')}</th>
              <th scope="col">{t('report.paid')}</th>
              <th scope="col">{t('report.status')}</th>
            </tr>
          </thead>
          <tbody>
            {report.members.map((r) => {
              const st = monthStatus(r);
              return (
                <tr key={r.memberId} className={`summary-row summary-row--${st.tone}`}>
                  <th scope="row">{r.name}</th>
                  <td>
                    <strong>
                      <Money value={r.settled} max={0} />
                    </strong>
                  </td>
                  <td>{paidCell(r, r.paid)}</td>
                  <td>
                    <StatusPill tone={st.tone}>{t(st.label)}</StatusPill>
                    {n(r.balance) > 0 && n(r.paid) > 0 ? (
                      <span className="summary-left small">
                        {t('report.left', { amount: taka(r.balance, 0) })}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t('common.total')}</th>
              <td data-testid="sum-settled">{taka(s.sumSettled, 0)}</td>
              <td>{taka(s.sumPaid, 0)}</td>
              <td>
                {n(s.sumBalance) > 0
                  ? t('report.left', { amount: taka(s.sumBalance, 0) })
                  : t('report.statusPaid')}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="muted small">
          {t('report.roundingSummary', {
            step: ROUND_UP_TO,
            calculated: taka(s.sumFinal, 0),
            rounded: taka(s.sumSettled, 0),
            extra: taka(s.roundingExtra, 0),
          })}
        </p>
      </Card>

      {/* 2. Previous due, kept apart from this month. */}
      <Card className="summary-card summary-card--previous" aria-labelledby="previous-title">
        <div className="stack-tight">
          <h2 id="previous-title" className="h3">
            {t('report.previousTitle')}
          </h2>
          <p className="muted small">{t('report.previousHint')}</p>
        </div>
        <table className="summary-table mono" data-testid="previous-summary">
          <thead>
            <tr>
              <th scope="col">{t('report.member')}</th>
              <th scope="col">{t('report.due')}</th>
              <th scope="col">{t('report.paid')}</th>
              <th scope="col">{t('report.status')}</th>
            </tr>
          </thead>
          <tbody>
            {previous.map((r) => {
              const st = previousStatus(r);
              return (
                <tr key={r.memberId}>
                  <th scope="row">{r.name}</th>
                  <td>
                    <Money value={r.previousDue} max={0} signed />
                  </td>
                  <td>{paidCell(r, r.previousPaid)}</td>
                  <td data-testid={`previous-status-${slug(r.name)}`}>
                    <StatusPill tone={st.tone}>
                      {n(r.previousBalance) > 0
                        ? `${t(st.label)} ${taka(r.previousBalance, 0)}`
                        : t(st.label)}
                    </StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t('common.total')}</th>
              <td>{taka(s.sumPreviousDue, 0)}</td>
              <td>{taka(s.sumPreviousPaid, 0)}</td>
              <td>
                {n(s.sumPreviousBalance) > 0
                  ? t('report.left', { amount: taka(s.sumPreviousBalance, 0) })
                  : t('report.statusClear')}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* 3. The full breakdown: names across the top, items down the side. */}
      <Card className="grid-card" aria-labelledby="breakdown-title">
        <h2 id="breakdown-title" className="h3 pad-x">
          {t('report.breakdown')}
        </h2>
        <div
          className="grid-scroll grid-scroll--fit"
          tabIndex={0}
          aria-labelledby="breakdown-title"
        >
          <table className="grid report-table report-table--transposed mono">
            <thead>
              <tr>
                <th scope="col" className="sticky">
                  {t('report.itemBdt')}
                </th>
                {report.members.map((r) => (
                  <th key={r.memberId} scope="col">
                    {r.name}
                  </th>
                ))}
                <th scope="col" className="report-total-col">
                  {t('common.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className={l.strong ? 'is-strong' : undefined}>
                  <th scope="row" className="sticky">
                    {t(l.label)}
                  </th>
                  {report.members.map((r) => (
                    <td key={r.memberId} data-testid={`${l.key}-${slug(r.name)}`}>
                      {l.key === 'meals' ? (
                        mealCount(r.meals)
                      ) : l.key === 'paid' ? (
                        paidCell(r, r.paid, true)
                      ) : (
                        <Bdt value={l.pick(r)} signed={l.signed ?? false} max={l.exact ? 2 : 0} />
                      )}
                    </td>
                  ))}
                  <td className="report-total-col" data-testid={`total-${l.key}`}>
                    {l.key === 'meals' ? (
                      mealCount(sum(l.pick))
                    ) : (
                      <Bdt value={sum(l.pick)} max={l.exact ? 2 : 0} />
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="sticky">
                  {t('report.status')}
                </th>
                {report.members.map((r) => {
                  const st = monthStatus(r);
                  return (
                    <td key={r.memberId}>
                      <span className={`tag tag--${st.tone}`}>{t(st.label)}</span>
                    </td>
                  );
                })}
                <td className="report-total-col" />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small pad-x">
          <span data-testid="sum-final">{taka(s.sumFinal, 0)}</span>{' '}
          {t('report.sumFinalNote', { target: taka(s.target, 0) })}
        </p>
      </Card>

      <NotesCard report={report} />
      <OverviewCard report={report} />
    </>
  );
}

/** The notes under the format's Payment Summary: how each number was made. */
function NotesCard({ report }: { report: Report }) {
  const o = report.overview;
  const s = report.settlement;
  const bills = report.bills;
  const first = report.members[0];
  const owing = [...report.members, ...report.former].filter((r) => !r.previousDue.isZero());
  const equal: [MessageKey, Fraction, Fraction | undefined][] = [
    ['report.khala', bills.khala, first?.khala],
    ['report.wifi', bills.wifi, first?.wifi],
    ['report.gas', bills.gas, first?.gas],
    ['report.electricity', bills.electricity, first?.electricity],
    ['report.other', bills.other, first?.other],
    ['report.extra', bills.extra, first?.extra],
  ];
  const shared = equal.filter(([, total]) => !total.isZero());

  return (
    <Card aria-labelledby="notes-title">
      <h2 id="notes-title" className="h3">
        {t('report.notes')}
      </h2>
      <ul className="notes small">
        <li>{t('report.noteHaveToPay')}</li>
        <li>{t('report.noteInitial', { rate: taka(o.initialRate, 2) })}</li>
        <li>
          {owing.length === 0
            ? t('report.notePreviousNone')
            : t('report.notePrevious', {
                list: owing.map((r) => `${r.name} ${taka(r.previousDue, 0)}`).join('; '),
              })}
        </li>
        {!bills.house_rent.isZero() ? (
          <li>
            {t('report.noteRent', {
              total: taka(bills.house_rent, 0),
              list: report.members.map((r) => `${r.name} ${taka(r.rent, 0)}`).join('; '),
            })}
          </li>
        ) : null}
        {shared.length > 0 ? (
          <li>
            {t('report.noteEqual', {
              bills: shared.map(([k, total]) => `${t(k)} (${taka(total, 0)})`).join(', '),
              count: o.activeMembers,
              each: shared.map(([, , each]) => taka(each ?? 0, 2)).join(' / '),
            })}
          </li>
        ) : null}
        <li>
          {t('report.noteRounding', {
            step: ROUND_UP_TO,
            list: report.members
              .map(
                (r) =>
                  `${r.name} ${taka(r.final, 0)} → ${taka(r.settled, 0)} (+${taka(r.adjustment, 0)})`,
              )
              .join('; '),
            extra: taka(s.roundingExtra, 0),
            rounded: taka(s.sumSettled, 0),
            calculated: taka(s.sumFinal, 0),
          })}
        </li>
      </ul>
    </Card>
  );
}

/** Page 2 of the format: the month at a glance and who did the most. */
function OverviewCard({ report }: { report: Report }) {
  const o = report.overview;
  const rows: [MessageKey, string, string, string?][] = [
    [
      'report.activeMembers',
      t('report.mealMembers', { count: o.activeMembers }),
      String(o.activeMembers),
    ],
    ['report.mealRate', `≈ ${taka(o.mealRateRounded, 0)}`, taka(o.mealRate, 2), 'meal-rate'],
    ['report.bazarRate', '—', taka(o.bazarRate, 2)],
    ['report.initialRate', '—', taka(o.initialRate, 2)],
    ['report.totalMeals', '—', mealCount(o.totalMeals)],
    ['report.totalMealCost', '—', taka(o.totalMealCost, 0)],
    ['report.totalBazar', '—', taka(o.totalBazar, 0)],
    ['report.totalInitial', '—', taka(o.totalInitial, 0)],
    ['report.khalaCount', '—', String(o.khalaCount)],
  ];
  const leaders: [MessageKey, typeof o.mostMeals, (v: Fraction) => string][] = [
    ['report.mostMeals', o.mostMeals, (v) => t('report.mealsValue', { count: mealCount(v) })],
    ['report.mostBazar', o.mostBazar, (v) => taka(v, 0)],
    ['report.mostInitial', o.mostInitial, (v) => taka(v, 0)],
    ['report.mostTrips', o.mostBazarTrips, (v) => t('report.tripsValue', { count: v.toFixed(0) })],
    [
      'report.mostInitialTrips',
      o.mostInitialTrips,
      (v) => t('report.tripsValue', { count: v.toFixed(0) }),
    ],
    ['report.mostSpend', o.mostTotalSpend, (v) => taka(v, 0)],
  ];

  return (
    <Card aria-labelledby="overview-title">
      <h2 id="overview-title" className="h3">
        {t('report.overview')}
      </h2>
      <table className="summary-table overview-table">
        <thead>
          <tr>
            <th scope="col">{t('report.category')}</th>
            <th scope="col">{t('report.detail')}</th>
            <th scope="col">{t('report.value')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, detail, value, testId]) => (
            <tr key={key}>
              <th scope="row">{t(key)}</th>
              <td className="muted">{detail}</td>
              <td className="mono" data-testid={testId}>
                {value}
              </td>
            </tr>
          ))}
          {leaders.map(([key, l, fmt]) => (
            <tr key={key} className="leader-row">
              <th scope="row">{t(key)}</th>
              <td className="leader-name">{l?.name ?? '—'}</td>
              <td className="mono leader-value">{l ? fmt(l.value) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
