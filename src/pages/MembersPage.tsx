import { useEffect, useState, type FormEvent } from 'react';
import { Copy, RefreshCw, Share2, UserPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/toast-context';
import { Button, Card, Field, PageHeader, Spinner, StatusPill, Tag } from '../components/ui';
import { t } from '../i18n';
import { useBundle } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import type { Member } from '../lib/api/schemas';
import { addMember, useMessMutation } from '../lib/api/writes';
import { initials } from '../lib/format';
import { getSupabase } from '../lib/supabase';
import { todayIn } from '../lib/time';

function joinUrl(code: string) {
  return `${location.origin}${import.meta.env.BASE_URL}#/join/${code}`;
}

/** QR rendered on demand (uqr is loaded lazily, only on this screen). */
function InviteQr({ url, label }: { url: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import('uqr').then(({ renderSVG }) => {
      if (live) setSvg(renderSVG(url, { border: 2, whiteColor: '#ffffff', blackColor: '#050807' }));
    });
    return () => {
      live = false;
    };
  }, [url]);
  return svg ? (
    <div className="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div className="qr qr--loading" aria-hidden="true" />
  );
}

export default function MembersPage() {
  const { messId, memberId, isManager } = useCurrentMess();
  const bundle = useBundle(messId);
  const qc = useQueryClient();
  const toast = useToast();
  const add = useMessMutation(messId, addMember);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b) return <PageHeader eyebrow="" title={t('members.title')} />;

  const url = joinUrl(b.mess.invite_code);
  const refresh = () => qc.invalidateQueries({ queryKey: ['bundle', messId] });

  const update = async (m: Member, patch: Partial<Pick<Member, 'role' | 'status' | 'left_on'>>) => {
    const sb = await getSupabase();
    const { error } = await sb.from('mess_members').update(patch).eq('id', m.id);
    if (error) toast.show(error.message, { tone: 'error' });
    await refresh();
  };

  const rotate = async () => {
    const sb = await getSupabase();
    const { error } = await sb.rpc('regenerate_invite_code', { p_mess: messId });
    if (error) toast.show(error.message, { tone: 'error' });
    else toast.show(t('members.rotated'));
    await refresh();
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: b.mess.name, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      toast.show(t('members.copied'));
    }
  };

  const nameError = name.trim() ? undefined : t('members.nameRequired');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameError) return;
    add.mutate(
      { displayName: name.trim() },
      {
        onSuccess: () => {
          toast.show(t('members.added', { name: name.trim() }));
          setName('');
          setTouched(false);
        },
        onError: (err) => toast.show(err.message, { tone: 'error' }),
      },
    );
  };

  return (
    <>
      <PageHeader eyebrow={b.mess.name.toUpperCase()} title={t('members.title')} />

      <Card aria-labelledby="invite-title" className="invite">
        <h2 id="invite-title" className="h3">
          {t('members.invite')}
        </h2>
        <p className="muted small">{t('members.inviteBody')}</p>
        <div className="invite__body">
          <InviteQr url={url} label={t('members.qrLabel', { name: b.mess.name })} />
          <div className="stack">
            <p className="mono invite-code" data-testid="invite-code">
              {b.mess.invite_code}
            </p>
            <div className="toolbar">
              <Button onClick={() => void share()}>
                <span className="row">
                  <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />
                  {t('members.share')}
                </span>
              </Button>
              <Button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(url)
                    .then(() => toast.show(t('members.copied')))
                }
              >
                <span className="row">
                  <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
                  {t('members.copy')}
                </span>
              </Button>
              {isManager ? (
                <Button onClick={() => void rotate()}>
                  <span className="row">
                    <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" />
                    {t('members.rotate')}
                  </span>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card aria-label={t('members.title')}>
        <ul className="list" role="list">
          {b.members.map((m) => (
            <li key={m.id} className="list-row">
              <span className="avatar mono" aria-hidden="true">
                {initials(m.display_name)}
              </span>
              <span className="list-row__name">
                {m.display_name}
                {m.id === memberId ? <Tag>{t('common.you')}</Tag> : null}
                {m.role === 'manager' ? <Tag tone="info">{t('common.manager')}</Tag> : null}
              </span>
              {m.user_id === null ? (
                <StatusPill tone="warn">{t('members.placeholder')}</StatusPill>
              ) : null}
              {m.status === 'left' ? (
                <StatusPill tone="idle">{t('members.left')}</StatusPill>
              ) : null}
              {isManager && m.id !== memberId ? (
                <span className="row">
                  <Button
                    onClick={() =>
                      void update(m, { role: m.role === 'manager' ? 'member' : 'manager' })
                    }
                  >
                    {m.role === 'manager'
                      ? t('members.makeMember', { name: m.display_name })
                      : t('members.makeManager', { name: m.display_name })}
                  </Button>
                  <Button
                    onClick={() =>
                      void update(
                        m,
                        m.status === 'active'
                          ? { status: 'left', left_on: todayIn(b.mess.timezone) }
                          : { status: 'active', left_on: null },
                      )
                    }
                  >
                    {m.status === 'active'
                      ? t('members.markLeft', { name: m.display_name })
                      : t('members.markActive', { name: m.display_name })}
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {isManager ? (
        <Card aria-labelledby="add-title">
          <h2 id="add-title" className="h3">
            {t('members.add')}
          </h2>
          <p className="muted small">{t('members.addHint')}</p>
          <form className="form form--inline" onSubmit={submit} noValidate>
            <Field
              id="new-member"
              label={t('members.name')}
              error={touched ? nameError : undefined}
            >
              <input
                id="new-member"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" disabled={add.isPending}>
              <span className="row">
                <UserPlus size={16} strokeWidth={1.5} aria-hidden="true" />
                {t('members.add')}
              </span>
            </Button>
          </form>
        </Card>
      ) : null}
    </>
  );
}
