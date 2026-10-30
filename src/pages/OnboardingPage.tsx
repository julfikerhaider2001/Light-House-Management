import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Card, Field } from '../components/ui';
import { t } from '../i18n';
import { previewInvite, useCreateMess, useJoinMess, type InvitePreview } from '../lib/api/mess';

export default function OnboardingPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const create = useCreateMess();
  const join = useJoinMess();
  const [messName, setMessName] = useState('Light House');
  const [code, setCode] = useState(params.code ?? '');
  // A code from a QR link (#/join/CODE) is looked up straight away.
  const [submitted, setSubmitted] = useState(params.code?.trim().toUpperCase() ?? '');
  const lookup = useQuery({
    queryKey: ['invite', submitted],
    enabled: submitted.length > 0,
    queryFn: () => previewInvite(submitted),
    retry: false,
  });
  const preview: InvitePreview | null = lookup.data ?? null;
  const looking = lookup.isFetching;
  const lookupError = lookup.isError
    ? t('errors.generic')
    : lookup.isSuccess && lookup.data === null
      ? t('onboarding.codeNotFound')
      : null;

  const done = () => void navigate('/', { replace: true });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ name: messName.trim() || 'Light House' }, { onSuccess: done });
  };

  const onJoin = (claimMemberId?: string) => {
    join.mutate(
      { code: code.trim(), ...(claimMemberId ? { claimMemberId } : {}) },
      { onSuccess: done },
    );
  };

  return (
    <main className="center-shell">
      <div className="stack onboarding">
        <h1>{t('onboarding.title')}</h1>

        <Card aria-labelledby="join-title">
          <h2 id="join-title">{t('onboarding.joinTitle')}</h2>
          <p className="muted">{t('onboarding.joinBody')}</p>
          <form
            className="form form--inline"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(code.trim().toUpperCase());
            }}
          >
            <Field id="code" label={t('onboarding.inviteCode')} error={lookupError ?? undefined}>
              <input
                id="code"
                className="mono code-input"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </Field>
            <Button type="submit" disabled={code.trim().length < 6 || looking}>
              {t('onboarding.lookUp')}
            </Button>
          </form>
          {preview ? (
            <div className="stack">
              {preview.placeholders.length > 0 ? (
                <>
                  <p>{t('onboarding.claimPrompt')}</p>
                  <div className="chip-grid">
                    {preview.placeholders.map((p) => (
                      <Button key={p.id} disabled={join.isPending} onClick={() => onJoin(p.id)}>
                        {p.display_name}
                      </Button>
                    ))}
                  </div>
                  <Button variant="primary" disabled={join.isPending} onClick={() => onJoin()}>
                    {t('onboarding.claimNone')}
                  </Button>
                </>
              ) : (
                <Button variant="primary" disabled={join.isPending} onClick={() => onJoin()}>
                  {t('onboarding.join', { name: preview.name })}
                </Button>
              )}
              {join.isError ? (
                <p className="form__error" role="alert">
                  {join.error.message}
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card aria-labelledby="create-title">
          <h2 id="create-title">{t('onboarding.createTitle')}</h2>
          <p className="muted">{t('onboarding.createBody')}</p>
          <form className="form" onSubmit={onCreate}>
            <Field id="mess-name" label={t('onboarding.messName')}>
              <input
                id="mess-name"
                value={messName}
                maxLength={60}
                onChange={(e) => setMessName(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {t('onboarding.create')}
            </Button>
            {create.isError ? (
              <p className="form__error" role="alert">
                {create.error.message}
              </p>
            ) : null}
          </form>
        </Card>
      </div>
    </main>
  );
}
