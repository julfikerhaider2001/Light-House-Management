import { describe, expect, it } from 'vitest';
import { computeReport } from './calc';
import { october2026 } from './calc/__fixtures__/october-2026';
import { september2026 } from './calc/__fixtures__/september-2026';
import { buildMemberEmail, buildReportEmail, mailtoLink } from './reportEmail';

const opts = {
  messName: 'Light House',
  month: 'October 2026',
  link: 'https://example.com/#/report',
};

describe('report email (mailto fallback)', () => {
  const email = buildReportEmail(computeReport(october2026), { ...opts, managerName: 'Ayman' });

  it('summarises the month and every member', () => {
    expect(email.subject).toBe('Light House · October 2026 report');
    expect(email.body).toContain('Meal rate ৳92.53');
    expect(email.body).toContain('Final pay total ৳21,425 (calculated ৳21,413');
    expect(email.body).toContain(
      '• Saad: 27 meals · bazar ৳3,812 · final pay ৳3,850 · paid ৳0 → Unpaid',
    );
    expect(email.body).toContain('Previous due: everyone clear.');
    expect(email.body).toContain('— Ayman');
  });

  it('builds a mailto link with everyone in BCC and %20 spaces', () => {
    const link = mailtoLink(['a@x.com', 'b@y.com'], email);
    expect(link.startsWith('mailto:?bcc=a%40x.com%2Cb%40y.com&subject=Light%20House')).toBe(true);
    expect(link).not.toContain('+');
    expect(decodeURIComponent(link.split('body=')[1] ?? '')).toBe(email.body);
  });
});

describe('member email (automatic month mailer)', () => {
  const report = computeReport({
    ...september2026,
    previousDues: [{ memberId: 's-saad', amount: 700 }],
    payments: [
      { memberId: 's-saad', amount: 200, appliesTo: 'previous_due' },
      { memberId: 's-asif', amount: 4675 },
    ],
  });
  const sep = { ...opts, month: 'September 2026' };

  it('leads with the member’s own final pay and keeps the old due separate', () => {
    const mail = buildMemberEmail(report, 's-saad', sep);
    expect(mail?.subject).toBe('Light House · September 2026 · your final pay ৳5,515');
    expect(mail?.text).toContain('Your final pay: ৳5,515 (Unpaid)');
    expect(mail?.text).toContain('Previous due (separate): Due ৳500');
    expect(mail?.html).toContain('Payment Summary');
    expect(mail?.html).toContain('Final Pay Summary');
    expect(mail?.html).toContain('Previous Due');
    expect(mail?.html).toContain('Overview &amp; Highlights');
    expect(mail?.html).toContain('৳21,420');
  });

  it('marks a member who paid in full', () => {
    expect(buildMemberEmail(report, 's-asif', sep)?.text).toContain('৳4,675 (Paid)');
  });

  it('escapes names and returns null for strangers', () => {
    const odd = computeReport({ ...september2026, members: [{ id: 'x', name: '<b>&' }] });
    expect(buildMemberEmail(odd, 'x', sep)?.html).toContain('&#60;b&#62;&#38;');
    expect(buildMemberEmail(report, 'nobody', sep)).toBeNull();
  });
});
