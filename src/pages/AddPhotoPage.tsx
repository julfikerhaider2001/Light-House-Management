import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PhotoPicker } from '../components/Avatar';
import { Button, Card } from '../components/ui';
import { t } from '../i18n';
import { profileKey, uploadAvatar } from '../lib/api/profile';

/** Accounts created before photos were required are asked once, before anything else. */
export default function AddPhotoPage({ userId, name }: { userId: string; name: string }) {
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const save = async () => {
    if (!photo) {
      setError(t('auth.photoRequired'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await uploadAvatar(userId, photo);
      await qc.invalidateQueries({ queryKey: profileKey(userId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="center-shell">
      <Card className="auth">
        <span className="eyebrow mono">{t('app.tagline')}</span>
        <h1>{t('profile.addPhotoTitle')}</h1>
        <p className="muted">{t('profile.addPhotoBody')}</p>
        <PhotoPicker
          id="photo"
          label={t('auth.photo')}
          name={name}
          file={photo}
          onChange={setPhoto}
          error={error}
        />
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {t('profile.savePhoto')}
        </Button>
      </Card>
    </main>
  );
}
