import { describe, expect, it } from 'vitest';
import { computeReport } from './calc';
import { october2026 } from './calc/__fixtures__/october-2026';
import { buildReportEmail, mailtoLink } from './reportEmail';

describe('report email', () => {
  const email = buildReportEmail(computeReport(october2026), {
    messName: 'Light House',
    month: 'October 2026',
    managerName: 'Ayman',
    link: 'https://example.com/#/report',
  });

  it('summarises the month and every member', () => {
    expect(email.subject).toBe('Light House · October 2026 report');
    expect(email.body).toContain('Meal rate ৳92.53');
    expect(email.body).toContain('Settled total ৳21,410 (sheet total ৳21,413');
    expect(email.body).toContain('• Alif: 22.5 meals · meal cost ৳2,082');
    expect(email.body).toMatch(/• Saad: .* to pay ৳3,84[56] · paid ৳0 → owes ৳3,84[56]/);
    expect(email.body).toContain('— Ayman, manager');
  });

  it('builds a mailto link with everyone in BCC and %20 spaces', () => {
    const link = mailtoLink(['a@x.com', 'b@y.com'], email);
    expect(link.startsWith('mailto:?bcc=a%40x.com%2Cb%40y.com&subject=Light%20House')).toBe(true);
    expect(link).not.toContain('+');
    expect(decodeURIComponent(link.split('body=')[1] ?? '')).toBe(email.body);
  });
});
