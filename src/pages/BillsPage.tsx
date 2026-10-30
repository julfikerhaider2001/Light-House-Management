import { useState } from 'react';
import { Card, Field, Money, PageHeader, Spinner } from '../components/ui';
import { useToast } from '../components/toast-context';
import { t, type MessageKey } from '../i18n';
import { periodMembers, useBundle, useReport } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import type { BillKind, Bundle } from '../lib/api/schemas';
import { setBill, setMemberAmount, useMessMutation } from '../lib/api/writes';
import type { MemberReport } from '../lib/calc';
import { taka } from '../lib/format';
import { formatMonth } from '../lib/time';

const FIXED_KINDS: BillKind[] = [
  'khala',
  'house_rent',
  'wifi',
  'gas',
  'electricity',
  'extra',
  'other',
];
const AMOUNT = /^\d+(\.\d{1,2})?$/;
const SIGNED_AMOUNT = /^-?\d+(\.\d{1,2})?$/;

/** A money input that saves on blur/Enter and shows inline validation. */
function AmountInput({
  id,
  label,
  value,
  allowBlank = false,
  signed = false,
  disabled,
  onSave,
  hint,
}: {
  id: string;
  label: string;
  value: number | null;
  allowBlank?: boolean;
  signed?: boolean;
  disabled: boolean;
  onSave: (next: number | null) => void;
  hint?: string;
}) {
  const shown = value === null ? '' : String(value);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? shown;
  const blank = text.trim() === '';
  const error = blank
    ? allowBlank
      ? undefined
      : t('bazar.amountInvalid')
    : (signed ? SIGNED_AMOUNT : AMOUNT).test(text.trim())
      ? undefined
      : t('bazar.amountInvalid');

  const commit = () => {
    if (draft === null) return;
    if (error) return;
    const next = blank ? null : Number(text.trim());
    setDraft(null);
    if (next !== value) onSave(next);
  };

  return (
    <Field
      id={id}
      label={label}
      error={draft !== null ? error : undefined}
      {...(hint ? { hint } : {})}
    >
      <input
        id={id}
        className="mono"
        inputMode="decimal"
        disabled={disabled}
        value={text}
        placeholder={allowBlank ? t('bills.split') : '0'}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
    </Field>
  );
}

export default function BillsPage() {
  const { messId, isManager } = useCurrentMess();
  const bundle = useBundle(messId);
  const report = useReport(bundle.data);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b || !report) return <PageHeader eyebrow="" title={t('bills.title')} />;

  return (
    <>
      <PageHeader eyebrow={formatMonth(b.period.month).toUpperCase()} title={t('bills.title')} />
      {!isManager ? <p className="notice notice--info">{t('bills.readOnly')}</p> : null}
      <BillsCard
        bundle={b}
        messId={messId}
        editable={isManager && b.period.status === 'open'}
        perHead={report.members[0]}
      />
      <MemberAmounts
        bundle={b}
        messId={messId}
        editable={isManager && b.period.status === 'open'}
        table="rent_shares"
      />
      <MemberAmounts
        bundle={b}
        messId={messId}
        editable={isManager && b.period.status === 'open'}
        table="previous_dues"
      />
    </>
  );
}

function BillsCard({
  bundle: b,
  messId,
  editable,
  perHead,
}: {
  bundle: Bundle;
  messId: string;
  editable: boolean;
  perHead: MemberReport | undefined;
}) {
  const save = useMessMutation(messId, setBill);
  const toast = useToast();
  const share: Partial<Record<BillKind, string>> = perHead
    ? {
        khala: taka(perHead.khala),
        wifi: taka(perHead.wifi),
        gas: taka(perHead.gas),
        electricity: taka(perHead.electricity),
        other: taka(perHead.other),
        extra: taka(perHead.extra),
      }
    : {};

  return (
    <Card aria-labelledby="bills-title">
      <h2 id="bills-title" className="h3">
        {t('bills.title')}
      </h2>
      <div className="form-grid">
        {FIXED_KINDS.map((kind) => {
          const rows = b.bills.filter((x) => x.kind === kind);
          const total = rows.reduce((s, x) => s + x.amount, 0);
          const first = rows[0];
          return (
            <AmountInput
              key={kind}
              id={`bill-${kind}`}
              label={t(`bills.${kind}` as MessageKey)}
              value={rows.length ? total : null}
              allowBlank
              disabled={!editable || rows.length > 1}
              {...(share[kind] ? { hint: t('bills.perHead', { amount: share[kind] }) } : {})}
              onSave={(amount) =>
                save.mutate(
                  { periodId: b.period.id, kind, amount: amount ?? 0, id: first?.id },
                  {
                    onSuccess: () => toast.show(t('bills.saved')),
                    onError: (err) => toast.show(err.message, { tone: 'error' }),
                  },
                )
              }
            />
          );
        })}
      </div>
    </Card>
  );
}

function MemberAmounts({
  bundle: b,
  messId,
  editable,
  table,
}: {
  bundle: Bundle;
  messId: string;
  editable: boolean;
  table: 'rent_shares' | 'previous_dues';
}) {
  const save = useMessMutation(messId, setMemberAmount);
  const toast = useToast();
  const members = periodMembers(b);
  const value = (memberId: string) =>
    table === 'rent_shares'
      ? (b.rent_shares.find((r) => r.member_id === memberId)?.fixed_amount ?? null)
      : (b.previous_dues.find((d) => d.member_id === memberId)?.amount ?? null);
  const title = table === 'rent_shares' ? t('bills.rentShares') : t('bills.dues');
  const hint = table === 'rent_shares' ? t('bills.rentHint') : t('bills.duesHint');
  const total =
    table === 'previous_dues' ? b.previous_dues.reduce((s, d) => s + d.amount, 0) : null;

  return (
    <Card aria-labelledby={`${table}-title`}>
      <div className="row-between">
        <h2 id={`${table}-title`} className="h3">
          {title}
        </h2>
        {total !== null ? <Money value={total} signed /> : null}
      </div>
      <p className="muted small">{hint}</p>
      <div className="form-grid">
        {members.map((m) => (
          <AmountInput
            key={m.id}
            id={`${table}-${m.id}`}
            label={m.display_name}
            value={value(m.id)}
            allowBlank={table === 'rent_shares'}
            signed={table === 'previous_dues'}
            disabled={!editable}
            onSave={(amount) =>
              save.mutate(
                { table, periodId: b.period.id, memberId: m.id, amount },
                {
                  onSuccess: () => toast.show(t('bills.saved')),
                  onError: (err) => toast.show(err.message, { tone: 'error' }),
                },
              )
            }
          />
        ))}
      </div>
    </Card>
  );
}
