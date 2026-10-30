import { ActivityLog } from '../components/ActivityLog';
import { Card, PageHeader, StatusPill } from '../components/ui';
import { t } from '../i18n';
import { useCurrentMess } from '../lib/api/current';
import { useRealtimeStatus } from '../lib/api/realtime';

export default function ActivityPage() {
  const { messId } = useCurrentMess();
  const live = useRealtimeStatus() === 'connected';
  return (
    <>
      <PageHeader
        eyebrow={t('app.name').toUpperCase()}
        title={t('activity.title')}
        aside={
          <StatusPill tone={live ? 'ok' : 'warn'}>
            {live ? t('activity.live') : t('common.loading').toUpperCase()}
          </StatusPill>
        }
      />
      <Card className="log-card">
        <ActivityLog messId={messId} />
      </Card>
    </>
  );
}
