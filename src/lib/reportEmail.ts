import type { Report } from './calc';
import { mealCount, taka } from './format';

export interface ReportEmail {
  subject: string;
  body: string;
}

/**
 * The month report as a plain-text email, sent from the current manager's own mail app.
 * Everyone gets the same message: the overview plus one line per member.
 */
export function buildReportEmail(
  report: Report,
  opts: { messName: string; month: string; managerName: string; link: string },
): ReportEmail {
  const o = report.overview;
  const lines = report.members.map((m) => {
    const status =
      m.balance.toNumber() > 0
        ? `owes ${taka(m.balance, 0)}`
        : m.balance.toNumber() < 0
          ? `credit ${taka(m.balance.toNumber() * -1, 0)}`
          : 'settled';
    return `• ${m.name}: ${mealCount(m.meals)} meals · meal cost ${taka(m.mealCost, 0)} · bazar ${taka(m.bazar, 0)} · to pay ${taka(m.settled, 0)} · paid ${taka(m.paid, 0)} → ${status}`;
  });
  const body = [
    `${opts.messName} — ${opts.month} report`,
    '',
    `Meal rate ${taka(o.mealRate, 2)} · total meals ${mealCount(o.totalMeals)} · total bazar ${taka(o.totalBazar, 0)}`,
    `Settled total ${taka(report.settlement.sumSettled, 0)} (sheet total ${taka(report.settlement.sumFinal, 0)}; rounding spread evenly)`,
    '',
    ...lines,
    '',
    `Full breakdown: ${opts.link}`,
    '',
    `— ${opts.managerName}, manager`,
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
