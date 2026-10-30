import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Plus } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { SwipeRow } from '../components/SwipeRow';
import { useToast } from '../components/toast-context';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Money,
  PageHeader,
  Spinner,
  StatusPill,
  Tag,
} from '../components/ui';
import { t } from '../i18n';
import { periodMembers, useBundle, useReport } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import type { Bundle, Payment } from '../lib/api/schemas';
import {
  addPayment,
  setDeleted,
  updatePayment,
  useMessMutation,
  type PaymentMethod,
} from '../lib/api/writes';
import { taka } from '../lib/format';
import { haptic } from '../lib/native';
import { formatDay, formatMonth, todayIn } from '../lib/time';

const METHODS: PaymentMethod[] = ['cash', 'bkash', 'nagad', 'bank'];
const AMOUNT = /^\d+(\.\d{1,2})?$/;

export default function PaymentsPage() {
  const { messId } = useCurrentMess();
  const bundle = useBundle(messId);
  const report = useReport(bundle.data);
  const remove = useMessMutation(messId, setDeleted);
  const toast = useToast();
  const [params] = useSearchParams();
  const [adding, setAdding] = useState<string | null>(() => params.get('member'));
  const [editing, setEditing] = useState<Payment | null>(null);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b || !report) return <PageHeader eyebrow="" title={t('payments.title')} />;

  const open = b.period.status === 'open';
  const names = new Map(b.members.map((m) => [m.id, m.display_name]));
  const list = [...b.payments].sort(
    (x, y) => y.date.localeCompare(x.date) || y.created_at.localeCompare(x.created_at),
  );

  const del = (p: Payment) =>
    remove.mutate(
      { table: 'payments', id: p.id, deleted: true },
      {
        onSuccess: () =>
          toast.show(t('payments.deleted'), {
            onUndo: () => remove.mutate({ table: 'payments', id: p.id, deleted: false }),
          }),
        onError: (err) => toast.show(err.message, { tone: 'error' }),
      },
    );

  return (
    <>
      <PageHeader
        eyebrow={formatMonth(b.period.month).toUpperCase()}
        title={t('payments.title')}
        aside={
          open ? (
            <Button variant="primary" onClick={() => setAdding('')}>
              <span className="row">
                <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
                {t('payments.add')}
              </span>
            </Button>
          ) : null
        }
      />

      <Card aria-labelledby="balances-title">
        <h2 id="balances-title" className="h3">
          {t('payments.balance')}
        </h2>
        <ul className="list" role="list">
          {report.members.map((r) => {
            const owes = r.balance.toNumber() > 0;
            const credit = r.balance.toNumber() < 0;
            return (
              <li key={r.memberId}>
                <button
                  type="button"
                  className="list-row list-row--link"
                  disabled={!open}
                  onClick={() => setAdding(r.memberId)}
                >
                  <span className="list-row__name">{r.name}</span>
                  <span className="mono muted small">
                    {taka(r.paid, 0)} / {taka(r.settled, 0)}
                  </span>
                  <StatusPill tone={owes ? 'due' : 'ok'}>
                    {owes ? t('common.due') : t('common.paid')}
                  </StatusPill>
                  <Money
                    value={r.balance.toNumber() === 0 ? 0 : Math.abs(r.balance.toNumber())}
                    className={owes ? 'money--due' : credit ? 'money--credit' : ''}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card aria-label={t('payments.title')}>
        {list.length === 0 ? (
          <EmptyState>{t('payments.empty')}</EmptyState>
        ) : (
          <div role="list">
            {list.map((p) => {
              const who = names.get(p.member_id) ?? '?';
              return (
                <div role="listitem" key={p.id}>
                  <SwipeRow
                    disabled={!open}
                    onDelete={() => del(p)}
                    deleteLabel={t('payments.delete', { what: `${who} ${taka(p.amount)}` })}
                  >
                    <button
                      type="button"
                      className="expense expense--button"
                      disabled={!open}
                      aria-label={t('payments.edit', { what: `${who} ${taka(p.amount)}` })}
                      onClick={() => setEditing(p)}
                    >
                      <div className="expense__main">
                        <span className="row">
                          <Tag tone="info">{t(`payments.${p.method}`).toUpperCase()}</Tag>
                          <strong>{who}</strong>
                        </span>
                        <span className="muted small mono">
                          {formatDay(p.date)}
                          {p.note ? ` · ${p.note}` : ''}
                        </span>
                      </div>
                      <Money value={p.amount} />
                    </button>
                  </SwipeRow>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Sheet open={adding !== null} title={t('payments.add')} onClose={() => setAdding(null)}>
        {adding !== null ? (
          <PaymentForm
            bundle={b}
            messId={messId}
            initialMember={adding || (periodMembers(b)[0]?.id ?? '')}
            suggested={(id) => {
              const r = report.members.find((m) => m.memberId === id);
              return r && r.balance.toNumber() > 0 ? r.balance.toNumber() : null;
            }}
            onDone={() => setAdding(null)}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={editing !== null}
        title={t('payments.editTitle')}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <PaymentForm
            bundle={b}
            messId={messId}
            initialMember={editing.member_id}
            existing={editing}
            suggested={() => null}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function PaymentForm({
  bundle: b,
  messId,
  initialMember,
  existing,
  suggested,
  onDone,
}: {
  bundle: Bundle;
  messId: string;
  initialMember: string;
  existing?: Payment;
  suggested: (memberId: string) => number | null;
  onDone: () => void;
}) {
  const save = useMessMutation(messId, addPayment);
  const change = useMessMutation(messId, updatePayment);
  const toast = useToast();
  const today = todayIn(b.mess.timezone);
  const month = b.period.month.slice(0, 7);
  const [member, setMember] = useState(initialMember);
  const [amount, setAmount] = useState(() =>
    existing ? String(existing.amount) : String(suggested(initialMember) ?? ''),
  );
  const [method, setMethod] = useState<PaymentMethod>(existing?.method ?? 'bkash');
  const [date, setDate] = useState(
    existing?.date ?? (today.startsWith(month) ? today : b.period.month),
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [submitted, setSubmitted] = useState(false);

  const amountError =
    AMOUNT.test(amount.trim()) && Number(amount) > 0 ? undefined : t('bazar.amountInvalid');
  const dateError = date.startsWith(month)
    ? undefined
    : t('bazar.dateOutside', { month: formatMonth(b.period.month) });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (amountError || dateError) return;
    const done = {
      onSuccess: () => {
        haptic('success');
        onDone();
      },
      onError: (err: Error) => toast.show(err.message, { tone: 'error' }),
    };
    if (existing) {
      change.mutate(
        {
          id: existing.id,
          amount: Number(amount.trim()),
          method,
          date,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        done,
      );
      return;
    }
    save.mutate(
      {
        periodId: b.period.id,
        memberId: member,
        amount: Number(amount.trim()),
        method,
        date,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          haptic('success');
          onDone();
        },
        onError: (err) => toast.show(err.message, { tone: 'error' }),
      },
    );
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field id="pay-member" label={t('payments.member')}>
        <select
          id="pay-member"
          value={member}
          disabled={existing !== undefined}
          onChange={(e) => {
            setMember(e.target.value);
            const s = suggested(e.target.value);
            if (s !== null) setAmount(String(s));
          }}
        >
          {periodMembers(b).map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="pay-amount"
        label={t('payments.amount')}
        error={submitted ? amountError : undefined}
      >
        <input
          id="pay-amount"
          className="mono"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <div className="segmented" role="radiogroup" aria-label={t('payments.method')}>
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            className="segmented__opt"
            onClick={() => setMethod(m)}
          >
            {t(`payments.${m}`)}
          </button>
        ))}
      </div>
      <Field id="pay-date" label={t('payments.date')} error={submitted ? dateError : undefined}>
        <input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field id="pay-note" label={t('payments.note')}>
        <input
          id="pay-note"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" disabled={save.isPending}>
        {t('payments.save')}
      </Button>
    </form>
  );
}
