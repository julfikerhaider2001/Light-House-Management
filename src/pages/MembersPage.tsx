import { useEffect, useState, type FormEvent } from 'react';
import {
  Copy,
  MoreHorizontal,
  RefreshCw,
  Share2,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { Sheet } from '../components/Sheet';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/toast-context';
import { Button, Card, Field, PageHeader, Spinner, Tag } from '../components/ui';
import { t, type MessageKey } from '../i18n';
import { useBundle } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import type { Member } from '../lib/api/schemas';
import { useAvatarUrls } from '../lib/api/profile';
import { addMember, useMessMutation } from '../lib/api/writes';
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
  const [managing, setManaging] = useState<Member | null>(null);
  const photos = useAvatarUrls(bundle.data);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b) return <PageHeader eyebrow="" title={t('members.title')} />;

  const url = joinUrl(b.mess.invite_code);
  // Joined members first, then invites nobody has claimed yet, then people who left.
  const groups: ['joined' | 'invited' | 'left', Member[]][] = [
    ['joined', b.members.filter((m) => m.status === 'active' && m.user_id !== null)],
    ['invited', b.members.filter((m) => m.status === 'active' && m.user_id === null)],
    ['left', b.members.filter((m) => m.status === 'left')],
  ];
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

      {groups.map(([key, list]) =>
        list.length ? (
          <Card key={key} aria-labelledby={`members-${key}`}>
            <div className="row-between">
              <h2 id={`members-${key}`} className="h3">
                {t(`members.group.${key}` as MessageKey)}
              </h2>
              <span className="mono muted small">{list.length}</span>
            </div>
            {key === 'invited' ? <p className="muted small">{t('members.invitedHint')}</p> : null}
            <ul className="list" role="list">
              {list.map((m) => (
                <li key={m.id} className={`list-row member-row member-row--${key}`}>
                  <Avatar
                    name={m.display_name}
                    url={m.user_id ? photos.get(m.user_id) : undefined}
                    size={40}
                    dashed={key === 'invited'}
                  />
                  <span className="member-row__text">
                    <span className="member-row__name">{m.display_name}</span>
                    <span className="member-row__chips">
                      {m.id === memberId ? <Tag>{t('common.you')}</Tag> : null}
                      {m.role === 'manager' ? <Tag tone="info">{t('common.manager')}</Tag> : null}
                      {key === 'invited' ? (
                        <span className="muted small">{t('members.notJoined')}</span>
                      ) : null}
                      {key === 'left' && m.left_on ? (
                        <span className="muted small mono">
                          {t('members.leftOn', { date: m.left_on })}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {isManager && m.id !== memberId ? (
                    <button
                      type="button"
                      className="icon-btn icon-btn--outline"
                      aria-label={t('members.manage', { name: m.display_name })}
                      onClick={() => setManaging(m)}
                    >
                      <MoreHorizontal size={18} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null,
      )}

      <Sheet
        open={managing !== null}
        title={managing?.display_name ?? ''}
        onClose={() => setManaging(null)}
      >
        {managing ? (
          <div className="action-list">
            {managing.user_id !== null && managing.status === 'active' ? (
              <button
                type="button"
                className="action-btn"
                onClick={() => {
                  void update(managing, {
                    role: managing.role === 'manager' ? 'member' : 'manager',
                  });
                  setManaging(null);
                }}
              >
                <ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" />
                <span className="action-btn__text">
                  <strong>
                    {managing.role === 'manager'
                      ? t('members.makeMember')
                      : t('members.makeManager')}
                  </strong>
                  <span className="muted small">
                    {managing.role === 'manager'
                      ? t('members.makeMemberHint')
                      : t('members.makeManagerHint')}
                  </span>
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className={`action-btn${managing.status === 'active' ? ' action-btn--danger' : ''}`}
              onClick={() => {
                void update(
                  managing,
                  managing.status === 'active'
                    ? { status: 'left', left_on: todayIn(b.mess.timezone) }
                    : { status: 'active', left_on: null },
                );
                setManaging(null);
              }}
            >
              {managing.status === 'active' ? (
                <UserMinus size={20} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <UserCheck size={20} strokeWidth={1.5} aria-hidden="true" />
              )}
              <span className="action-btn__text">
                <strong>
                  {managing.status === 'active' ? t('members.markLeft') : t('members.markActive')}
                </strong>
                <span className="muted small">
                  {managing.status === 'active'
                    ? t('members.markLeftHint')
                    : t('members.markActiveHint')}
                </span>
              </span>
            </button>
          </div>
        ) : null}
      </Sheet>

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
