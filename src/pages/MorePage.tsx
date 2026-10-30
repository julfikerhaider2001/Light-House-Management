import { Link } from 'react-router';
import {
  Activity,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  Gauge,
  LogOut,
  ReceiptText,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Card, PageHeader } from '../components/ui';
import { t, type MessageKey } from '../i18n';
import { useBundle } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import { signOut } from '../lib/api/session';

const LINKS: { to: string; label: MessageKey; icon: LucideIcon }[] = [
  { to: '/bills', label: 'nav.bills', icon: ReceiptText },
  { to: '/payments', label: 'nav.payments', icon: Wallet },
  { to: '/close', label: 'nav.close', icon: ClipboardCheck },
  { to: '/activity', label: 'nav.activity', icon: Activity },
  { to: '/members', label: 'nav.members', icon: Users },
  { to: '/import', label: 'nav.import', icon: FileSpreadsheet },
  { to: '/status', label: 'nav.status', icon: Gauge },
];

export default function MorePage() {
  const { memberships, messId, switchMess } = useCurrentMess();
  const bundle = useBundle(messId);
  const code = bundle.data?.mess.invite_code;
  return (
    <>
      <PageHeader eyebrow={t('app.name').toUpperCase()} title={t('nav.more')} />
      {code ? (
        <Card aria-labelledby="invite-title">
          <h2 id="invite-title" className="h3">
            {t('onboarding.inviteCode')}
          </h2>
          <p className="mono invite-code" data-testid="invite-code">
            {code}
          </p>
        </Card>
      ) : null}
      <Card>
        <ul className="list" role="list">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="list-row list-row--link">
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                <span className="list-row__name">{t(label)}</span>
                <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" className="muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      {memberships.length > 1 ? (
        <Card>
          <ul className="list" role="list">
            {memberships.map((m) => (
              <li key={m.mess_id}>
                <button
                  type="button"
                  className="list-row list-row--link"
                  aria-current={m.mess_id === messId}
                  onClick={() => switchMess(m.mess_id)}
                >
                  <span className="list-row__name">{m.messes.name}</span>
                  {m.mess_id === messId ? <span className="tag tag--ok">●</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Card>
        <button type="button" className="list-row list-row--link" onClick={() => void signOut()}>
          <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
          <span className="list-row__name">{t('auth.signOut')}</span>
        </button>
      </Card>
    </>
  );
}
