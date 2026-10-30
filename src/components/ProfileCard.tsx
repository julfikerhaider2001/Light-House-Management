import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PhotoPicker } from './Avatar';
import { Card } from './ui';
import { useToast } from './toast-context';
import { t } from '../i18n';
import { useCurrentMess } from '../lib/api/current';
import { profileKey, uploadAvatar, useAvatarUrl, useMyProfile } from '../lib/api/profile';

/** The signed-in person's name and photo; picking a new photo saves it straight away. */
export function ProfileCard() {
  const { userId, messId } = useCurrentMess();
  const profile = useMyProfile(userId);
  const url = useAvatarUrl(profile.data?.avatar_path);
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!profile.data) return null;

  const change = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      await uploadAvatar(userId, file);
      await Promise.all([
        qc.invalidateQueries({ queryKey: profileKey(userId) }),
        qc.invalidateQueries({ queryKey: ['bundle', messId] }),
      ]);
      toast.show(t('profile.photoSaved'));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t('errors.generic'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="profile-card" aria-label={profile.data.display_name}>
      <PhotoPicker
        id="profile-photo"
        label={busy ? t('common.saving') : t('profile.changePhoto')}
        name={profile.data.display_name}
        file={null}
        currentUrl={url}
        onChange={(f) => void change(f)}
      />
      <strong>{profile.data.display_name}</strong>
    </Card>
  );
}
