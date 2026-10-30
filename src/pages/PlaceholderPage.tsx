import { Link } from 'react-router';
import { Card, PageHeader } from '../components/ui';
import { t } from '../i18n';

/** Routes whose screens ship in a later PR land here instead of a blank page. */
export default function PlaceholderPage() {
  return (
    <>
      <PageHeader eyebrow={t('app.name').toUpperCase()} title={t('common.loading')} />
      <Card>
        <p className="muted">This screen is on its way in the next release.</p>
        <Link to="/">{t('nav.today')}</Link>
      </Card>
    </>
  );
}
