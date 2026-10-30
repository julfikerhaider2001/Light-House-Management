import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useToast } from '../components/toast-context';
import { Button, Card, Money, PageHeader, Spinner } from '../components/ui';
import { t, type MessageKey } from '../i18n';
import { useBundle } from '../lib/api/bundle';
import { useCurrentMess } from '../lib/api/current';
import type { Bundle } from '../lib/api/schemas';
import { addMember, setBill } from '../lib/api/writes';
import { mealCount } from '../lib/format';
import type { ParsedSheet } from '../lib/importSheet';
import { getSupabase } from '../lib/supabase';
import { formatMonth, monthDays } from '../lib/time';

const norm = (s: string) => s.trim().toLowerCase();

interface Diff {
  rows: {
    name: string;
    isNew: boolean;
    meals: [number, number];
    bazar: [number, number];
    initial: [number, number];
  }[];
  bills: { kind: string; now: number; after: number }[];
  newNames: string[];
}

/** What the period will look like after the import (meals replace by day; expenses add). */
function diff(b: Bundle, parsed: ParsedSheet): Diff {
  const byName = new Map(b.members.map((m) => [norm(m.display_name), m]));
  const names = [...new Set([...b.members.map((m) => m.display_name), ...parsed.members])];
  const rows = names
    .filter((n, i, all) => all.findIndex((x) => norm(x) === norm(n)) === i)
    .map((name) => {
      const member = byName.get(norm(name));
      const now = (kind: 'bazar' | 'initial') =>
        b.expenses
          .filter((e) => e.member_id === member?.id && e.kind === kind)
          .reduce((s, e) => s + e.amount, 0);
      const imported = (kind: 'bazar' | 'initial') =>
        parsed.expenses
          .filter((e) => norm(e.name) === norm(name) && e.kind === kind)
          .reduce((s, e) => s + e.amount, 0);
      const importedDays = new Map(
        parsed.meals.filter((m) => norm(m.name) === norm(name)).map((m) => [m.day, m.meals]),
      );
      const existing = b.meals.filter((m) => m.member_id === member?.id);
      const mealsNow = existing.reduce((s, m) => s + m.meals, 0);
      const kept = existing
        .filter((m) => !importedDays.has(Number(m.date.slice(8, 10))))
        .reduce((s, m) => s + m.meals, 0);
      const mealsAfter = kept + [...importedDays.values()].reduce((s, v) => s + v, 0);
      return {
        name,
        isNew: !member,
        meals: [mealsNow, mealsAfter] as [number, number],
        bazar: [now('bazar'), now('bazar') + imported('bazar')] as [number, number],
        initial: [now('initial'), now('initial') + imported('initial')] as [number, number],
      };
    });
  const bills = parsed.bills.map((x) => ({
    kind: x.kind,
    now: b.bills.filter((y) => y.kind === x.kind).reduce((s, y) => s + y.amount, 0),
    after: x.amount,
  }));
  return { rows, bills, newNames: rows.filter((r) => r.isNew).map((r) => r.name) };
}

export default function ImportPage() {
  const { messId, isManager } = useCurrentMess();
  const bundle = useBundle(messId);
  const qc = useQueryClient();
  const toast = useToast();
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  if (bundle.isPending) return <Spinner label={t('common.loading')} />;
  const b = bundle.data;
  if (!b) return <PageHeader eyebrow="" title={t('import.title')} />;
  const month = formatMonth(b.period.month);
  const days = monthDays(b.period.month);

  const read = async (file: File) => {
    setReading(true);
    try {
      const [XLSX, { parseWorkbook }] = await Promise.all([
        import('xlsx'),
        import('../lib/importSheet'),
      ]);
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      setParsed(parseWorkbook(wb, XLSX.utils));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t('errors.generic'), { tone: 'error' });
    } finally {
      setReading(false);
    }
  };

  const run = async (p: ParsedSheet, d: Diff) => {
    setImporting(true);
    try {
      for (const name of d.newNames) await addMember(messId, { displayName: name });
      const sb = await getSupabase();
      const { data: members, error } = await sb
        .from('mess_members')
        .select('id, display_name')
        .eq('mess_id', messId);
      if (error) throw error;
      const idOf = new Map(members.map((m) => [norm(m.display_name), m.id]));
      const date = (day: number) => days[day - 1] ?? days[0] ?? b.period.month;

      for (let i = 0; i < p.meals.length; i += 20) {
        const results = await Promise.all(
          p.meals.slice(i, i + 20).map((m) =>
            sb.rpc('set_meal', {
              p_mess: messId,
              p_member: idOf.get(norm(m.name)) ?? '',
              p_date: date(m.day),
              p_meals: m.meals,
            }),
          ),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      }
      if (p.expenses.length) {
        const { error: expErr } = await sb.from('expenses').insert(
          p.expenses.map((e) => ({
            mess_id: messId,
            period_id: b.period.id,
            member_id: idOf.get(norm(e.name)) ?? '',
            date: date(e.day),
            amount: e.amount,
            kind: e.kind,
            items: e.items,
          })),
        );
        if (expErr) throw expErr;
      }
      for (const bill of p.bills) {
        const existing = b.bills.filter((x) => x.kind === bill.kind);
        await setBill(messId, {
          periodId: b.period.id,
          kind: bill.kind,
          amount: bill.amount,
          id: existing.length === 1 ? existing[0]?.id : undefined,
        });
      }
      toast.show(t('import.done', { meals: p.meals.length, expenses: p.expenses.length }));
      setParsed(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : t('errors.generic'), { tone: 'error' });
    } finally {
      setImporting(false);
      await qc.invalidateQueries({ queryKey: ['bundle', messId] });
    }
  };

  const d = parsed ? diff(b, parsed) : null;
  const pair = ([a, z]: [number, number], money = false) =>
    a === z ? (
      money ? (
        <Money value={a} />
      ) : (
        <span>{mealCount(a)}</span>
      )
    ) : (
      <span>
        <span className="muted">{money ? <Money value={a} /> : mealCount(a)}</span> →{' '}
        <strong className="money--credit">{money ? <Money value={z} /> : mealCount(z)}</strong>
      </span>
    );

  return (
    <>
      <PageHeader eyebrow={month.toUpperCase()} title={t('import.title')} />
      <Card>
        <p className="muted small">{t('import.body')}</p>
        {isManager ? (
          <label className="file-btn">
            <FileSpreadsheet size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>{reading ? t('import.reading') : t('import.choose')}</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void read(file);
              }}
            />
          </label>
        ) : (
          <p className="notice notice--info">{t('import.managerOnly')}</p>
        )}
      </Card>

      {parsed && d ? (
        <Card aria-labelledby="preview-title" className="grid-card">
          <h2 id="preview-title" className="h3 pad-x">
            {t('import.preview')}
          </h2>
          {parsed.meals.length === 0 && parsed.expenses.length === 0 ? (
            <p className="pad-x muted">{t('import.noData')}</p>
          ) : (
            <>
              <div className="grid-scroll" tabIndex={0}>
                <table className="grid report-table mono">
                  <thead>
                    <tr>
                      <th scope="col" className="sticky">
                        {t('import.member')}
                      </th>
                      <th scope="col">{t('import.meals')}</th>
                      <th scope="col">{t('import.bazar')}</th>
                      <th scope="col">{t('import.initial')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.name}>
                        <th scope="row" className="sticky">
                          {r.name}
                          {r.isNew ? <span className="tag tag--warn">NEW</span> : null}
                        </th>
                        <td>{pair(r.meals)}</td>
                        <td>{pair(r.bazar, true)}</td>
                        <td>{pair(r.initial, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pad-x stack">
                {d.bills.length ? (
                  <dl className="kv-list mono">
                    {d.bills.map((x) => (
                      <div key={x.kind}>
                        <dt>{t(`bills.${x.kind}` as MessageKey)}</dt>
                        <dd>{pair([x.now, x.after], true)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {d.newNames.length ? (
                  <p className="notice notice--warn">
                    {t('import.newMembers', { names: d.newNames.join(', ') })}
                  </p>
                ) : null}
                {parsed.warnings.length ? (
                  <div className="notice notice--warn stack-tight" role="status">
                    <strong>{t('import.warnings')}</strong>
                    {parsed.warnings.map((w) => (
                      <span key={w} className="small">
                        {w}
                      </span>
                    ))}
                  </div>
                ) : null}
                <Button
                  variant="primary"
                  disabled={importing || b.period.status !== 'open'}
                  onClick={() => void run(parsed, d)}
                >
                  {importing ? t('import.importing') : t('import.confirm', { month })}
                </Button>
              </div>
            </>
          )}
        </Card>
      ) : null}
    </>
  );
}
