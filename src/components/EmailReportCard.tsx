import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { Card } from './ui';
import { t } from '../i18n';
import type { Report } from '../lib/calc';
import type { Bundle } from '../lib/api/schemas';
import { buildReportEmail, mailtoLink } from '../lib/reportEmail';
import { getSupabase } from '../lib/supabase';
import { formatMonth } from '../lib/time';

/**
 * After a month is closed the current manager sends the report from their own mail app:
 * every joined member in BCC, the report in the message. Works whoever is manager today.
 */
export function EmailReportCard({ bundle: b, report }: { bundle: Bundle; report: Report }) {
  const contacts = useQuery({
    queryKey: ['contacts', b.mess.id],
    queryFn: async () => {
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('member_contacts', { p_mess: b.mess.id });
      if (error) throw error;
      return data;
    },
  });
  const emails = (contacts.data ?? []).map((c) => c.email);
  const month = formatMonth(b.period.month);
  const manager = b.members.find((m) => m.id === b.me)?.display_name ?? '';
  const link = `${location.origin}${import.meta.env.BASE_URL}#/report?period=${b.period.id}`;
  const href = mailtoLink(
    emails,
    buildReportEmail(report, { messName: b.mess.name, month, managerName: manager, link }),
  );

  return (
    <Card aria-labelledby="email-title">
      <h2 id="email-title" className="h3">
        {t('close.emailTitle')}
      </h2>
      <p className="muted small">{t('close.emailBody')}</p>
      {emails.length > 0 ? (
        <a className="btn btn--primary btn--block" href={href} data-testid="email-report">
          <span className="row">
            <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
            {t('close.emailButton', { count: emails.length })}
          </span>
        </a>
      ) : contacts.isSuccess ? (
        <p className="notice notice--info">{t('close.emailNone')}</p>
      ) : null}
    </Card>
  );
}
