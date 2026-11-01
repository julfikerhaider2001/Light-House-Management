import type { MemberReport, Report } from './calc';
import type { Fraction } from './calc/fraction';
import { mealCount, taka } from './format';

// The month report as email. Pure: used by the app (mailto fallback) and by the automatic
// month mailer (scripts/month-mail.ts), which sends each member their own copy.

export interface ReportEmail {
  subject: string;
  body: string;
}

export interface EmailOpts {
  messName: string;
  month: string;
  link: string;
}

const n = (f: Fraction) => f.toNumber();

function monthStatus(r: MemberReport): string {
  if (n(r.settled) <= 0) return 'Gets back';
  if (n(r.balance) <= 0) return 'Paid';
  if (n(r.paid) > 0) return `Partly paid · ${taka(r.balance, 0)} left`;
  return 'Unpaid';
}

function previousStatus(r: MemberReport): string {
  const left = n(r.previousBalance);
  if (left > 0) return `Due ${taka(left, 0)}`;
  if (left < 0) return `Credit ${taka(-left, 0)}`;
  return 'Clear';
}

/** Plain-text lines shared by both emails: one line per member. */
function memberLines(report: Report): string[] {
  return report.members.map(
    (m) =>
      `• ${m.name}: ${mealCount(m.meals)} meals · bazar ${taka(m.bazar, 0)} · final pay ${taka(m.settled, 0)} · paid ${taka(m.paid, 0)} → ${monthStatus(m)}`,
  );
}

/** One message for everyone, sent from the sender's own mail app (manual fallback). */
export function buildReportEmail(
  report: Report,
  opts: EmailOpts & { managerName: string },
): ReportEmail {
  const o = report.overview;
  const s = report.settlement;
  const owing = [...report.members, ...report.former].filter((m) => n(m.previousBalance) !== 0);
  const body = [
    `${opts.messName} — ${opts.month} payment summary`,
    '',
    `Meal rate ${taka(o.mealRate, 2)} · total meals ${mealCount(o.totalMeals)} · total bazar ${taka(o.totalBazar, 0)}`,
    `Final pay total ${taka(s.sumSettled, 0)} (calculated ${taka(s.sumFinal, 0)}; each rounded up to ৳5)`,
    '',
    ...memberLines(report),
    '',
    owing.length > 0
      ? `Previous due (separate): ${owing.map((m) => `${m.name} ${previousStatus(m)}`).join(' · ')}`
      : 'Previous due: everyone clear.',
    '',
    `Full report: ${opts.link}`,
    '',
    `— ${opts.managerName}`,
  ].join('\n');
  return { subject: `${opts.messName} · ${opts.month} report`, body };
}

/** mailto: with everyone in BCC so addresses are not shared with each other. */
export function mailtoLink(emails: readonly string[], email: ReportEmail): string {
  const params = new URLSearchParams({
    bcc: emails.join(','),
    subject: email.subject,
    body: email.body,
  });
  // URLSearchParams encodes spaces as "+", which mail apps show literally; use %20.
  return `mailto:?${params.toString().replace(/\+/g, '%20')}`;
}

export interface MemberEmail {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Email clients ignore stylesheets, so every style is inline. Light colours read well in
// both light and dark mail apps.
const C = {
  ink: '#10231a',
  muted: '#5b6b62',
  line: '#d9e2dc',
  head: '#dbe7ff',
  zebra: '#f4f7f5',
  green: '#c9f2d9',
  red: '#fde0e0',
  redText: '#c62828',
  greenText: '#11823b',
  orange: '#fff1df',
};
const table = `border-collapse:collapse;width:100%;font-size:13px;color:${C.ink}`;
const cell = `padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap`;
const cellL = `${cell};text-align:left`;
const th = (label: string, left = false) =>
  `<th style="${left ? cellL : cell};background:${C.head};font-weight:700">${label}</th>`;

/**
 * The month report for one member: their own numbers first, then the mess's full
 * Payment Summary in the agreed format (report_format/format.tex).
 */
export function buildMemberEmail(
  report: Report,
  memberId: string,
  opts: EmailOpts,
): MemberEmail | null {
  const me = [...report.members, ...report.former].find((m) => m.memberId === memberId);
  if (!me) return null;
  const o = report.overview;
  const s = report.settlement;
  const subject = `${opts.messName} · ${opts.month} · your final pay ${taka(me.settled, 0)}`;
  const owesNow = n(me.balance) > 0;
  const oldLeft = n(me.previousBalance);

  const text = [
    `Hi ${me.name},`,
    '',
    `${opts.messName} — ${opts.month} payment summary`,
    '',
    `Your final pay: ${taka(me.settled, 0)} (${monthStatus(me)})`,
    `Meals ${mealCount(me.meals)} · meal cost ${taka(me.mealCost, 0)} · bazar ${taka(me.bazar, 0)} · paid ${taka(me.paid, 0)}`,
    `Previous due (separate): ${previousStatus(me)}`,
    '',
    `Meal rate ${taka(o.mealRate, 2)} · total meals ${mealCount(o.totalMeals)} · total bazar ${taka(o.totalBazar, 0)}`,
    '',
    ...memberLines(report),
    '',
    `Full report: ${opts.link}`,
    '',
    '— Light House (sent automatically every month)',
  ].join('\n');

  const money = (f: Fraction, max = 0) => esc(taka(f, max));
  type Row = readonly [string, (m: MemberReport) => string];
  const rows: Row[] = [
    ['Bazar', (m) => money(m.bazar)],
    ['Meal cost', (m) => money(m.mealCost)],
    ['Have to pay', (m) => money(m.haveToPay)],
    ['Khala bill', (m) => money(m.khala)],
    ['House rent', (m) => money(m.rent)],
    ['WiFi', (m) => money(m.wifi, 2)],
    ['Gas', (m) => money(m.gas, 2)],
    ...(report.bills.electricity.isZero()
      ? []
      : [['Electricity', (m: MemberReport) => money(m.electricity, 2)] as Row]),
    ...(report.bills.other.isZero()
      ? []
      : [['Other', (m: MemberReport) => money(m.other, 2)] as Row]),
    ['Init. cost', (m) => money(m.initialPaid)],
    ['Have to pay (init.)', (m) => money(m.initialDue, 2)],
    ['Sub-total', (m) => money(m.total)],
    ['Extra pay', (m) => money(m.extra, 2)],
    ['Final pay', (m) => `<b>${money(m.settled)}</b>`],
    ['Status', (m) => esc(monthStatus(m))],
  ];
  const breakdown = `<table style="${table}">
<tr>${th('', true)}${report.members.map((m) => th(esc(m.name))).join('')}</tr>
${rows
  .map(
    ([label, pick], i) =>
      `<tr style="background:${label === 'Final pay' ? C.green : i % 2 ? '#fff' : C.zebra}"><th style="${cellL};font-weight:600">${label}</th>${report.members
        .map(
          (m) =>
            `<td style="${cell}${m.memberId === memberId ? ';font-weight:700' : ''}">${pick(m)}</td>`,
        )
        .join('')}</tr>`,
  )
  .join('\n')}
</table>`;

  const summary = `<table style="${table}">
<tr>${th('Name', true)}${th('Final pay')}${th('Paid')}${th('Status', true)}</tr>
${report.members
  .map((m) => {
    const owes = n(m.balance) > 0 && n(m.settled) > 0;
    return `<tr style="background:${owes ? C.red : C.green}"><td style="${cellL}">${esc(m.name)}</td><td style="${cell};font-weight:700">${money(m.settled)}</td><td style="${cell}">${money(m.paid)}</td><td style="${cellL};color:${owes ? C.redText : C.greenText};font-weight:700">${esc(monthStatus(m))}</td></tr>`;
  })
  .join('\n')}
<tr style="background:${C.green};font-weight:700"><td style="${cellL}">Total</td><td style="${cell}">${money(s.sumSettled)}</td><td style="${cell}">${money(s.sumPaid)}</td><td style="${cellL}"></td></tr>
</table>`;

  const previous = `<table style="${table}">
<tr>${th('Name', true)}${th('Due')}${th('Paid')}${th('Status', true)}</tr>
${[...report.members, ...report.former]
  .map(
    (m) =>
      `<tr><td style="${cellL}">${esc(m.name)}</td><td style="${cell}">${money(m.previousDue)}</td><td style="${cell}">${money(m.previousPaid)}</td><td style="${cellL}">${esc(previousStatus(m))}</td></tr>`,
  )
  .join('\n')}
<tr style="background:${C.orange};font-weight:700"><td style="${cellL}">Total</td><td style="${cell}">${money(s.sumPreviousDue)}</td><td style="${cell}">${money(s.sumPreviousPaid)}</td><td style="${cellL}"></td></tr>
</table>`;

  const leader = (label: string, l: typeof o.mostMeals, fmt: (v: Fraction) => string) =>
    `<tr><td style="${cellL}">${label}</td><td style="${cellL};color:${C.greenText};font-weight:700">${l ? esc(l.name) : '—'}</td><td style="${cell};color:${C.redText};font-weight:700">${l ? esc(fmt(l.value)) : '—'}</td></tr>`;
  const stat = (label: string, value: string) =>
    `<tr><td style="${cellL}">${label}</td><td style="${cellL}"></td><td style="${cell}">${esc(value)}</td></tr>`;
  const overview = `<table style="${table}">
<tr>${th('Category', true)}${th('Detail', true)}${th('Value')}</tr>
${stat('Active members', String(o.activeMembers))}
${stat('Meal rate', taka(o.mealRate, 2))}
${stat('Bazar rate', taka(o.bazarRate, 2))}
${stat('Initial cost rate', taka(o.initialRate, 2))}
${stat('Total meals', mealCount(o.totalMeals))}
${stat('Total meal cost', taka(o.totalMealCost, 0))}
${stat('Total bazar cost', taka(o.totalBazar, 0))}
${stat('Total initial cost', taka(o.totalInitial, 0))}
${stat('Khala count', String(o.khalaCount))}
${leader('Most meal consumer', o.mostMeals, (v) => `${mealCount(v)} meals`)}
${leader('Most bazar contributor', o.mostBazar, (v) => taka(v, 0))}
${leader('Most initial cost contributor', o.mostInitial, (v) => taka(v, 0))}
${leader('Maximum bazar done by', o.mostBazarTrips, (v) => `${v.toFixed(0)} trips`)}
${leader('Maximum initial marketing done by', o.mostInitialTrips, (v) => `${v.toFixed(0)} trips`)}
${leader('Most money spent (bazar + initial)', o.mostTotalSpend, (v) => taka(v, 0))}
</table>`;

  const h2 = (title: string) =>
    `<h2 style="font-size:15px;margin:24px 0 8px;color:${C.ink};text-decoration:underline">${title}</h2>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#eef2ef">
<div style="max-width:720px;margin:0 auto;padding:20px;font-family:Segoe UI,Roboto,Arial,sans-serif;color:${C.ink};background:#ffffff">
<p style="margin:0;color:${C.muted};font-size:12px;letter-spacing:.12em;text-transform:uppercase">${esc(opts.messName)}</p>
<h1 style="font-size:20px;margin:4px 0 2px">Mess Meal Management System</h1>
<p style="margin:0 0 16px;font-size:15px">${esc(opts.month)} · Payment Summary</p>
<div style="border:2px solid ${owesNow ? C.redText : C.greenText};border-radius:10px;padding:14px 16px;background:${owesNow ? C.red : C.green}">
<p style="margin:0;font-size:13px">Hi ${esc(me.name)}, your final pay for ${esc(opts.month)}:</p>
<p style="margin:4px 0;font-size:26px;font-weight:800">${money(me.settled)} <span style="font-size:14px;font-weight:700;color:${owesNow ? C.redText : C.greenText}">${esc(monthStatus(me))}</span></p>
<p style="margin:0;font-size:13px;color:${C.muted}">${mealCount(me.meals)} meals × ${esc(taka(o.mealRate, 2))} · bazar ${money(me.bazar)} · paid ${money(me.paid)}</p>
${oldLeft !== 0 ? `<p style="margin:8px 0 0;font-size:13px;font-weight:700;color:${oldLeft > 0 ? C.redText : C.greenText}">Previous due (separate): ${esc(previousStatus(me))}</p>` : ''}
</div>
${h2('Payment Summary')}
<div style="overflow-x:auto">${breakdown}</div>
${h2('Final Pay Summary')}
${summary}
<p style="font-size:12px;color:${C.muted};margin:6px 0 0">Final pay is rounded up to the next ৳5: calculated ${money(s.sumFinal)}, rounded ${money(s.sumSettled)}.</p>
${h2('Previous Due')}
${previous}
${h2('Overview &amp; Highlights')}
${overview}
<p style="margin:24px 0 0"><a href="${esc(opts.link)}" style="color:${C.greenText};font-weight:700">Open the full report in Light House</a></p>
<p style="margin:12px 0 0;font-size:11px;color:${C.muted}">Sent automatically by Light House every month.</p>
</div></body></html>`;

  return { subject, text, html };
}
