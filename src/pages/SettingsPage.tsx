import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast-context';
import { Button, Card, Field, PageHeader, Spinner } from '../components/ui';
import { t } from '../i18n';
import { useBundle } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import { membershipsKey, useMemberships } from '../lib/api/mess';
import { useSession } from '../lib/api/session';
import { getSupabase } from '../lib/supabase';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function SettingsPage() {
  const { messId, memberId, userId, switchMess } = useCurrentMess();
  const bundle = useBundle(messId);
  const all = useMemberships(userId);
  const session = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [cutoff, setCutoff] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b) return <PageHeader eyebrow="" title={t('settings.title')} />;

  const nameValue = name ?? b.mess.name;
  const cutoffValue = cutoff ?? b.mess.meal_cutoff_time.slice(0, 5);
  const nameError = nameValue.trim() ? undefined : t('settings.nameRequired');
  const cutoffError = TIME.test(cutoffValue) ? undefined : t('settings.timeInvalid');
  const othersJoined = b.members.filter(
    (m) => m.user_id !== null && m.status === 'active' && m.id !== memberId,
  ).length;
  const deleted = (all.data ?? []).filter((m) => m.messes.deleted_at !== null);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['bundle', messId] }),
      qc.invalidateQueries({ queryKey: membershipsKey }),
    ]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (nameError || cutoffError) return;
    const sb = await getSupabase();
    const { error } = await sb
      .from('messes')
      .update({ name: nameValue.trim(), meal_cutoff_time: cutoffValue })
      .eq('id', messId);
    if (error) toast.show(error.message, { tone: 'error' });
    else toast.show(t('profile.saved'));
    setName(null);
    setCutoff(null);
    await refresh();
  };

  // Double verification: the exact mess name, and the account password again.
  const remove = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteError(undefined);
    if (confirmName.trim() !== b.mess.name) {
      setDeleteError(t('settings.nameMismatch'));
      return;
    }
    const email = session.status === 'ready' ? session.session?.user.email : undefined;
    if (!email) return;
    setBusy(true);
    try {
      const sb = await getSupabase();
      const check = await sb.auth.signInWithPassword({ email, password });
      if (check.error) {
        setDeleteError(t('settings.wrongPassword'));
        return;
      }
      const { error } = await sb.rpc('delete_mess', {
        p_mess: messId,
        p_confirm_name: confirmName.trim(),
      });
      if (error) throw error;
      setDeleting(false);
      toast.show(t('settings.deleted', { name: b.mess.name }));
      await refresh();
      void navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string) => {
    const sb = await getSupabase();
    const { error } = await sb.rpc('restore_mess', { p_mess: id });
    if (error) {
      toast.show(error.message, { tone: 'error' });
      return;
    }
    await refresh();
    switchMess(id);
    toast.show(t('settings.restored'));
  };

  return (
    <>
      <PageHeader eyebrow={b.mess.name.toUpperCase()} title={t('settings.title')} />

      <Card aria-labelledby="mess-title">
        <h2 id="mess-title" className="h3">
          {t('settings.mess')}
        </h2>
        <form className="form" onSubmit={(e) => void save(e)} noValidate>
          <Field id="mess-name" label={t('onboarding.messName')} error={nameError}>
            <input
              id="mess-name"
              maxLength={60}
              value={nameValue}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            id="mess-cutoff"
            label={t('settings.reminder')}
            error={cutoffError}
            hint={t('settings.reminderHint')}
          >
            <input
              id="mess-cutoff"
              type="time"
              value={cutoffValue}
              onChange={(e) => setCutoff(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary">
            {t('common.save')}
          </Button>
        </form>
      </Card>

      <Card aria-labelledby="danger-title">
        <h2 id="danger-title" className="h3">
          {t('settings.deleteTitle')}
        </h2>
        <p className="muted small">
          {othersJoined > 0
            ? t('settings.cannotDelete', { count: othersJoined })
            : t('settings.deleteBody')}
        </p>
        <Button variant="danger" disabled={othersJoined > 0} onClick={() => setDeleting(true)}>
          <span className="row">
            <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('settings.deleteButton')}
          </span>
        </Button>
      </Card>

      {deleted.length > 0 ? (
        <Card aria-labelledby="deleted-title">
          <h2 id="deleted-title" className="h3">
            {t('settings.deletedTitle')}
          </h2>
          <ul className="list" role="list">
            {deleted.map((m) => (
              <li key={m.mess_id} className="list-row">
                <span className="list-row__name">{m.messes.name}</span>
                <Button onClick={() => void restore(m.mess_id)}>
                  <span className="row">
                    <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
                    {t('settings.restore')}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Sheet open={deleting} title={t('settings.deleteTitle')} onClose={() => setDeleting(false)}>
        {deleting ? (
          <form className="form" onSubmit={(e) => void remove(e)} noValidate>
            <p className="muted small">{t('settings.confirmBody', { name: b.mess.name })}</p>
            <Field id="confirm-name" label={t('settings.typeName', { name: b.mess.name })}>
              <input
                id="confirm-name"
                autoComplete="off"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </Field>
            <Field id="confirm-password" label={t('auth.password')} error={deleteError}>
              <div className="input-affix">
                <input
                  id="confirm-password"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="input-affix__btn"
                  aria-label={reveal ? t('auth.hidePassword') : t('auth.showPassword')}
                  aria-pressed={reveal}
                  onClick={() => setReveal(!reveal)}
                >
                  {reveal ? (
                    <EyeOff size={18} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Eye size={18} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </button>
              </div>
            </Field>
            <Button
              type="submit"
              variant="danger"
              disabled={busy || confirmName.trim() !== b.mess.name || password.length < 8}
            >
              {t('settings.deleteForever', { name: b.mess.name })}
            </Button>
          </form>
        ) : null}
      </Sheet>
    </>
  );
}
