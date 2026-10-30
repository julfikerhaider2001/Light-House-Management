import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Card, Field } from './ui';
import { useToast } from './toast-context';
import { t } from '../i18n';
import { getSupabase } from '../lib/supabase';

/** Replace the password (e.g. a temporary one set by the admin). */
export function ChangePasswordCard() {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const shortError = password.length >= 8 ? undefined : t('auth.passwordShort');
  const matchError = confirm === password ? undefined : t('profile.passwordMismatch');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (shortError || matchError) return;
    setBusy(true);
    try {
      const sb = await getSupabase();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirm('');
      setSubmitted(false);
      toast.show(t('profile.passwordChanged'));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t('errors.generic'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (
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
  );

  return (
    <Card aria-labelledby="password-title">
      <h2 id="password-title" className="h3">
        {t('profile.changePassword')}
      </h2>
      <form className="form" onSubmit={(e) => void submit(e)} noValidate>
        <Field
          id="new-password"
          label={t('profile.newPassword')}
          error={submitted ? shortError : undefined}
          hint={t('auth.passwordHint')}
        >
          <div className="input-affix">
            <input
              id="new-password"
              type={reveal ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {toggle}
          </div>
        </Field>
        <Field
          id="confirm-password"
          label={t('profile.confirmPassword')}
          error={submitted ? matchError : undefined}
        >
          <input
            id="confirm-password"
            type={reveal ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={busy}>
          {t('profile.changePassword')}
        </Button>
      </form>
    </Card>
  );
}
