import { useState, type FormEvent } from 'react';
import { Camera, Plus, X } from 'lucide-react';
import { Sheet } from '../components/Sheet';
import { SwipeRow } from '../components/SwipeRow';
import { useToast } from '../components/toast-context';
import { Button, Card, EmptyState, Field, Money, PageHeader, Spinner, Tag } from '../components/ui';
import { t } from '../i18n';
import { periodMembers, useBundle } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import type { Bundle, Expense } from '../lib/api/schemas';
import { addExpense, setDeleted, useMessMutation } from '../lib/api/writes';
import { Fraction } from '../lib/calc/fraction';
import { taka } from '../lib/format';
import { compressImage } from '../lib/image';
import { haptic } from '../lib/native';
import { getSupabase } from '../lib/supabase';
import { formatDay, formatMonth, todayIn } from '../lib/time';

export default function BazarPage() {
  const { messId, memberId, isManager } = useCurrentMess();
  const bundle = useBundle(messId);
  const remove = useMessMutation(messId, setDeleted);
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b) return <PageHeader eyebrow="" title={t('bazar.title')} />;

  const open = b.period.status === 'open';
  const names = new Map(b.members.map((m) => [m.id, m.display_name]));
  const list = [...b.expenses].sort(
    (x, y) => y.date.localeCompare(x.date) || y.created_at.localeCompare(x.created_at),
  );
  const total = Fraction.sum(
    b.expenses.filter((e) => e.kind === 'bazar').map((e) => Fraction.from(e.amount)),
  );

  const del = (e: Expense) => {
    remove.mutate(
      { table: 'expenses', id: e.id, deleted: true },
      {
        onSuccess: () => {
          haptic('warning');
          toast.show(t('bazar.deleted'), {
            onUndo: () => remove.mutate({ table: 'expenses', id: e.id, deleted: false }),
          });
        },
        onError: (err) => toast.show(err.message, { tone: 'error' }),
      },
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={`${formatMonth(b.period.month).toUpperCase()} · ${taka(total, 0)}`}
        title={t('bazar.title')}
      />
      <Card aria-label={t('bazar.title')} className={open ? 'has-fab' : ''}>
        {list.length === 0 ? (
          <EmptyState>{t('bazar.empty')}</EmptyState>
        ) : (
          <div role="list" data-testid="expense-list">
            {list.map((e) => {
              const who = names.get(e.member_id) ?? '?';
              const canDelete = open && (isManager || e.member_id === memberId);
              return (
                <div role="listitem" key={e.id}>
                  <SwipeRow
                    disabled={!canDelete}
                    onDelete={() => del(e)}
                    deleteLabel={t('bazar.delete', { what: `${who} ${taka(e.amount)}` })}
                  >
                    <div className="expense">
                      <div className="expense__main">
                        <span className="row">
                          <Tag tone={e.kind === 'bazar' ? 'ok' : 'info'}>
                            {e.kind === 'bazar' ? 'BAZAR' : 'INITIAL'}
                          </Tag>
                          <strong>{who}</strong>
                        </span>
                        <span className="muted small mono">
                          {formatDay(e.date)}
                          {e.items.length > 0
                            ? ` · ${e.items.map((i) => `${i.name}-${i.amount}`).join(', ')}`
                            : ''}
                          {e.note ? ` · ${e.note}` : ''}
                        </span>
                      </div>
                      <Money value={e.amount} />
                    </div>
                  </SwipeRow>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {open && !adding ? (
        <button type="button" className="fab" onClick={() => setAdding(true)}>
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          {t('bazar.add')}
        </button>
      ) : null}
      <Sheet open={adding} title={t('bazar.addTitle')} onClose={() => setAdding(false)}>
        {adding ? (
          <ExpenseForm
            bundle={b}
            messId={messId}
            memberId={memberId}
            isManager={isManager}
            onDone={() => setAdding(false)}
          />
        ) : null}
      </Sheet>
    </>
  );
}

interface ItemRow {
  key: number;
  name: string;
  amount: string;
}

const AMOUNT = /^\d+(\.\d{1,2})?$/;

function ExpenseForm({
  bundle: b,
  messId,
  memberId,
  isManager,
  onDone,
}: {
  bundle: Bundle;
  messId: string;
  memberId: string;
  isManager: boolean;
  onDone: () => void;
}) {
  const save = useMessMutation(messId, addExpense);
  const toast = useToast();
  const today = todayIn(b.mess.timezone);
  const month = b.period.month.slice(0, 7);
  const [kind, setKind] = useState<'bazar' | 'initial'>('bazar');
  const [date, setDate] = useState(today.startsWith(month) ? today : b.period.month);
  const [payer, setPayer] = useState(memberId);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [total, setTotal] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nextKey, setNextKey] = useState(1);

  const itemsValid = items.every((i) => i.name.trim() && AMOUNT.test(i.amount.trim()));
  const itemSum = itemsValid
    ? Fraction.sum(items.map((i) => Fraction.from(i.amount.trim())))
    : Fraction.ZERO;
  const amountText = items.length > 0 ? itemSum.toFixed(2) : total.trim();
  const amountOk = AMOUNT.test(amountText) && Number(amountText) > 0;
  const dateOk = date.startsWith(month);
  const errors = {
    items: items.length > 0 && !itemsValid ? t('bazar.itemInvalid') : undefined,
    amount: !amountOk ? t('bazar.amountInvalid') : undefined,
    date: !dateOk ? t('bazar.dateOutside', { month: formatMonth(b.period.month) }) : undefined,
  };
  const valid = !errors.items && !errors.amount && !errors.date;
  const members = periodMembers(b).filter((m) => m.status === 'active');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    setBusy(true);
    try {
      let receiptPath: string | undefined;
      if (photo) {
        const blob = await compressImage(photo);
        const path = `${messId}/${crypto.randomUUID()}.webp`;
        const sb = await getSupabase();
        const { error } = await sb.storage
          .from('receipts')
          .upload(path, blob, { contentType: 'image/webp' });
        if (error) throw error;
        receiptPath = path;
      }
      await save.mutateAsync({
        periodId: b.period.id,
        memberId: payer,
        date,
        amount: Number(amountText),
        kind,
        items: items.map((i) => ({ name: i.name.trim(), amount: Number(i.amount.trim()) })),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(receiptPath ? { receiptPath } : {}),
      });
      haptic('success');
      onDone();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t('errors.generic'), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <div className="segmented" role="radiogroup" aria-label={t('bazar.kind')}>
        {(['bazar', 'initial'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className="segmented__opt"
            onClick={() => setKind(k)}
          >
            {k === 'bazar' ? t('bazar.kindBazar') : t('bazar.kindInitial')}
          </button>
        ))}
      </div>

      <div className="form-row">
        <Field id="exp-date" label={t('bazar.date')} error={show('date')}>
          <input
            id="exp-date"
            type="date"
            value={date}
            min={b.period.month}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field id="exp-payer" label={t('bazar.paidBy')}>
          <select
            id="exp-payer"
            value={payer}
            disabled={!isManager}
            onChange={(e) => setPayer(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="items">
        <legend>{t('bazar.items')}</legend>
        {items.map((item, idx) => (
          <div className="item-row" key={item.key}>
            <input
              aria-label={`${t('bazar.itemName')} ${idx + 1}`}
              placeholder={t('bazar.itemName')}
              value={item.name}
              onChange={(e) =>
                setItems(
                  items.map((i) => (i.key === item.key ? { ...i, name: e.target.value } : i)),
                )
              }
            />
            <input
              aria-label={`${t('bazar.itemAmount')} ${idx + 1}`}
              placeholder="0"
              inputMode="decimal"
              className="mono"
              value={item.amount}
              onChange={(e) =>
                setItems(
                  items.map((i) => (i.key === item.key ? { ...i, amount: e.target.value } : i)),
                )
              }
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={t('bazar.removeItem', { name: item.name || String(idx + 1) })}
              onClick={() => setItems(items.filter((i) => i.key !== item.key))}
            >
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        ))}
        {show('items') ? (
          <span className="field__msg" role="alert">
            {errors.items}
          </span>
        ) : null}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setItems([...items, { key: nextKey, name: '', amount: '' }]);
            setNextKey(nextKey + 1);
          }}
        >
          + {t('bazar.addItem')}
        </button>
      </fieldset>

      <Field
        id="exp-total"
        label={t('bazar.total')}
        error={show('amount')}
        hint={t('bazar.totalHint')}
      >
        <input
          id="exp-total"
          inputMode="decimal"
          className="mono"
          readOnly={items.length > 0}
          value={
            items.length > 0 ? (itemsValid ? itemSum.toFixed(2).replace(/\.00$/, '') : '') : total
          }
          onChange={(e) => setTotal(e.target.value)}
        />
      </Field>

      <Field id="exp-note" label={t('bazar.note')}>
        <input
          id="exp-note"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <label className="file-btn">
        <Camera size={18} strokeWidth={1.5} aria-hidden="true" />
        <span>{photo ? photo.name : t('bazar.receipt')}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </label>

      <Button type="submit" variant="primary" disabled={busy}>
        {busy && photo ? t('bazar.compressing') : t('bazar.save')}
      </Button>
    </form>
  );
}
