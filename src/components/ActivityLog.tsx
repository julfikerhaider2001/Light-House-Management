import { formatActivity, formatClock } from '../lib/activityFormat';
import { useActivity } from '../lib/api/activity';
import { useBundle } from '../lib/api/bundle';
import { t } from '../i18n';

/** Monospace live log: `HH:MM:SS  TAG  message`. */
export function ActivityLog({ messId, limit = 200 }: { messId: string; limit?: number }) {
  const activity = useActivity(messId, limit);
  const bundle = useBundle(messId);
  const names = new Map(bundle.data?.members.map((m) => [m.id, m.display_name]) ?? []);
  const nameOf = (id: string) => names.get(id) ?? '—';
  const rows = activity.data ?? [];

  if (activity.isSuccess && rows.length === 0) {
    return <p className="muted small">{t('activity.empty')}</p>;
  }

  return (
    <ol className="log mono" aria-live="polite" data-testid="activity-log">
      {rows.map((row) => {
        const f = formatActivity(row, nameOf);
        return (
          <li key={row.id} className="log__row">
            <time dateTime={row.created_at} className="muted">
              {formatClock(row.created_at)}
            </time>
            <span className={`tag tag--${f.tone}`}>{f.tag}</span>
            <span className="log__msg">{f.message}</span>
          </li>
        );
      })}
    </ol>
  );
}
