import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ChevronRight, LogOut, Settings } from 'lucide-react';
import { ProfileCard } from '../components/ProfileCard';
import { useToast } from '../components/toast-context';
import { Button, Card, Field, PageHeader, Spinner } from '../components/ui';
import { t } from '../i18n';
import { useCurrentMess } from '../lib/api/current';
import { membershipsKey } from '../lib/api/mess';
import { profileKey, useMyProfile } from '../lib/api/profile';
import { signOut, useSession } from '../lib/api/session';
import { getSupabase } from '../lib/supabase';

const PHONE = /^\+?[0-9 -]{6,20}$/;

export default function ProfilePage() {
  const { userId, messId } = useCurrentMess();
  const session = useSession();
  const profile = useMyProfile(userId);
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile.data) return <Spinner label={t('common.loading')} />;
  const email = session.status === 'ready' ? (session.session?.user.email ?? '') : '';
  const nameValue = name ?? profile.data.display_name;
  const phoneValue = phone ?? profile.data.phone ?? '';
  const nameError = nameValue.trim() ? undefined : t('auth.nameRequired');
  const phoneError =
    phoneValue.trim() === '' || PHONE.test(phoneValue.trim())
      ? undefined
      : t('profile.phoneInvalid');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (nameError || phoneError) return;
    setBusy(true);
    try {
      const sb = await getSupabase();
      const { error } = await sb
        .from('profiles')
        .update({
          display_name: nameValue.trim(),
          ...(phone !== null ? { phone: phoneValue.trim() || null } : {}),
        })
        .eq('id', userId);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: profileKey(userId) }),
        qc.invalidateQueries({ queryKey: membershipsKey }),
        qc.invalidateQueries({ queryKey: ['bundle', messId] }),
      ]);
      setName(null);
      toast.show(t('profile.saved'));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t('errors.generic'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow={t('app.name').toUpperCase()} title={t('profile.title')} />
      <ProfileCard />
      <Card aria-labelledby="details-title">
        <h2 id="details-title" className="h3">
          {t('profile.details')}
        </h2>
        <form className="form" onSubmit={(e) => void save(e)} noValidate>
          <Field id="profile-name" label={t('auth.displayName')} error={nameError}>
            <input
              id="profile-name"
              autoComplete="name"
              maxLength={60}
              value={nameValue}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            id="profile-phone"
            label={t('profile.phone')}
            error={phoneError}
            hint={t('profile.phoneHint')}
          >
            <input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phoneValue}
              placeholder="+8801…"
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field id="profile-email" label={t('auth.email')}>
            <input id="profile-email" value={email} readOnly className="mono" />
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('common.save')}
          </Button>
        </form>
      </Card>
      <Card>
        <ul className="list" role="list">
          <li>
            <Link to="/settings" className="list-row list-row--link">
              <Settings size={18} strokeWidth={1.5} aria-hidden="true" />
              <span className="list-row__name">{t('settings.title')}</span>
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" className="muted" />
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="list-row list-row--link"
              onClick={() => void signOut()}
            >
              <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
              <span className="list-row__name">{t('auth.signOut')}</span>
            </button>
          </li>
        </ul>
      </Card>
    </>
  );
}
