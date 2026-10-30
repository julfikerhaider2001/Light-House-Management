import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { PhotoPicker } from '../components/Avatar';
import { Button, Card, Field } from '../components/ui';
import { t } from '../i18n';
import { uploadAvatar } from '../lib/api/profile';
import { signIn, signUp, useSession } from '../lib/api/session';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage() {
  const session = useSession();
  const location = useLocation();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  // Stay here while a new account's photo is still uploading.
  if (session.status === 'ready' && session.session && !busy) {
    return <Navigate to={from} replace />;
  }

  const errors = {
    email: EMAIL.test(email.trim()) ? undefined : t('auth.emailInvalid'),
    password: password.length >= 8 ? undefined : t('auth.passwordShort'),
    name: mode === 'signIn' || name.trim() ? undefined : t('auth.nameRequired'),
    photo: mode === 'signIn' || photo ? undefined : t('auth.photoRequired'),
  };
  const valid = !errors.email && !errors.password && !errors.name && !errors.photo;
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true, name: true, photo: true });
    if (!valid) return;
    setBusy(true);
    setServerError(null);
    try {
      if (mode === 'signUp') {
        const userId = await signUp(email.trim(), password, name.trim());
        if (userId && photo) await uploadAvatar(userId, photo);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="center-shell">
      <Card className="auth">
        <span className="eyebrow mono">{t('app.tagline')}</span>
        <h1>{mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}</h1>
        <form onSubmit={(e) => void submit(e)} noValidate className="form">
          {mode === 'signUp' ? (
            <PhotoPicker
              id="photo"
              label={t('auth.photo')}
              name={name}
              file={photo}
              onChange={(f) => {
                setPhoto(f);
                setTouched((s) => ({ ...s, photo: true }));
              }}
              error={show('photo')}
            />
          ) : null}
          {mode === 'signUp' ? (
            <Field id="name" label={t('auth.displayName')} error={show('name')}>
              <input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, name: true }))}
                aria-invalid={Boolean(show('name'))}
              />
            </Field>
          ) : null}
          <Field id="email" label={t('auth.email')} error={show('email')}>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              aria-invalid={Boolean(show('email'))}
            />
          </Field>
          <Field
            id="password"
            label={t('auth.password')}
            error={show('password')}
            hint={t('auth.passwordHint')}
          >
            <div className="input-affix">
              <input
                id="password"
                type={reveal ? 'text' : 'password'}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                aria-invalid={Boolean(show('password'))}
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
          {serverError ? (
            <p className="form__error" role="alert">
              {serverError}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy}>
            {mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
          </Button>
        </form>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setServerError(null);
          }}
        >
          {mode === 'signIn' ? t('auth.switchToSignUp') : t('auth.switchToSignIn')}
        </button>
      </Card>
    </main>
  );
}
