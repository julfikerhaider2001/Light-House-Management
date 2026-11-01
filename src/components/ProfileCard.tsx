import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PhotoPicker } from './Avatar';
import { Button, Card } from './ui';
import { useToast } from './toast-context';
import { t } from '../i18n';
import { useCurrentMess } from '../lib/api/current';
import {
  profileKey,
  removeAvatar,
  uploadAvatar,
  useAvatarUrl,
  useMyProfile,
} from '../lib/api/profile';

/** The signed-in person's name and photo; picking a new photo saves it straight away. */
export function ProfileCard() {
  const { userId, messId } = useCurrentMess();
  const profile = useMyProfile(userId);
  const url = useAvatarUrl(profile.data?.avatar_path);
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!profile.data) return null;
  const path = profile.data.avatar_path;

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      await Promise.all([
        qc.invalidateQueries({ queryKey: profileKey(userId) }),
        qc.invalidateQueries({ queryKey: ['bundle', messId] }),
      ]);
      toast.show(done);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t('errors.generic'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const change = (file: File | null) => {
    if (file) void run(() => uploadAvatar(userId, file), t('profile.photoSaved'));
  };
  const remove = () => {
    if (window.confirm(t('profile.removePhotoConfirm'))) {
      void run(() => removeAvatar(userId, path), t('profile.photoRemoved'));
    }
  };

  return (
    <Card className="profile-card" aria-label={profile.data.display_name}>
      <PhotoPicker
        id="profile-photo"
        label={busy ? t('common.saving') : path ? t('profile.changePhoto') : t('profile.addPhoto')}
        name={profile.data.display_name}
        file={null}
        currentUrl={path ? url : undefined}
        onChange={change}
      />
      <strong>{profile.data.display_name}</strong>
      {path ? (
        <Button variant="danger" disabled={busy} onClick={remove} data-testid="remove-photo">
          <span className="row">
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
            {t('profile.removePhoto')}
          </span>
        </Button>
      ) : null}
    </Card>
  );
}
