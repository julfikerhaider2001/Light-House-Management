// Monthly close + report emails. Runs daily from .github/workflows/month-mail.yml.
//
// 1. Any month that has ended but is still open is closed (snapshot + dues carried forward),
//    exactly like pressing "Close" in the app, so every month's numbers stand on their own.
// 2. Every closed month whose report has not been emailed yet is sent: each joined member
//    gets their own report (their final pay, previous due, and the full summary).
//
// The numbers come from the app's own calc engine, and the database work goes through the
// app's RPCs as a member of that mess, so RLS and the close rules apply unchanged.
//
// Env: DATABASE_URL, or SUPABASE_DB_PASSWORD with supabase/.temp/pooler-url (after
// `supabase link`). SMTP_USER + SMTP_PASS (Gmail app password), optional SMTP_HOST,
// SMTP_PORT, MAIL_FROM_NAME, APP_URL. DRY_RUN=1 computes and logs without writing or sending.
import { readFileSync } from 'node:fs';
import nodemailer from 'nodemailer';
import pg from 'pg';
import { BundleSchema, type Bundle } from '../src/lib/api/schemas';
import { computeReport, type Report } from '../src/lib/calc';
import { closingCarry, toCalcInput } from '../src/lib/calcInput';
import { buildMemberEmail } from '../src/lib/reportEmail';
import { formatMonth } from '../src/lib/time';

const env = process.env;
const DRY_RUN = env.DRY_RUN === '1' || env.DRY_RUN === 'true';
const APP_URL = env.APP_URL ?? 'https://julfikerhaider2001.github.io/Light-House-Management/';

function connectionString(): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const password = env.SUPABASE_DB_PASSWORD;
  if (!password) throw new Error('Set DATABASE_URL or SUPABASE_DB_PASSWORD');
  const url = new URL(readFileSync('supabase/.temp/pooler-url', 'utf8').trim());
  url.password = password;
  return url.toString();
}

const client = new pg.Client({
  connectionString: connectionString(),
  ssl: { rejectUnauthorized: false },
});

/** Runs `work` in one transaction as that user, so auth.uid() and RLS behave as in the app. */
async function asUser<T>(userId: string, work: () => Promise<T>): Promise<T> {
  await client.query('begin');
  try {
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    await client.query('set local role authenticated');
    const result = await work();
    await client.query(DRY_RUN ? 'rollback' : 'commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

/** The manager if they have an account, else the longest-standing joined member. */
async function actorFor(messId: string): Promise<string | null> {
  const { rows } = await client.query<{ user_id: string }>(
    `select user_id from public.mess_members
     where mess_id = $1 and status = 'active' and user_id is not null
     order by (role = 'manager') desc, joined_on, display_name
     limit 1`,
    [messId],
  );
  return rows[0]?.user_id ?? null;
}

async function bundleOf(messId: string, periodId: string): Promise<Bundle> {
  const { rows } = await client.query<{ b: unknown }>(
    'select public.get_period_bundle($1, $2) as b',
    [messId, periodId],
  );
  return BundleSchema.parse(rows[0]?.b);
}

const reportOf = (b: Bundle): Report => computeReport(toCalcInput(b));

interface PeriodRow {
  id: string;
  mess_id: string;
  month: string;
  name: string;
}

/** Months that have ended (in the mess's own timezone) but were never closed. */
async function closeEndedMonths(): Promise<void> {
  const { rows } = await client.query<PeriodRow>(
    `select p.id, p.mess_id, to_char(p.month, 'YYYY-MM-DD') as month, m.name
     from public.periods p
     join public.messes m on m.id = p.mess_id
     where p.status = 'open' and p.reopened_at is null and m.deleted_at is null
       and p.month < date_trunc('month', now() at time zone m.timezone)::date
     order by p.month`,
  );
  for (const p of rows) {
    const actor = await actorFor(p.mess_id);
    if (!actor) {
      console.warn(`skip close ${p.name} ${p.month}: no joined member`);
      continue;
    }
    const total = await asUser(actor, async () => {
      const report = reportOf(await bundleOf(p.mess_id, p.id));
      const snapshot = JSON.parse(
        JSON.stringify({ month: p.month, report, closedAutomatically: true }),
      ) as unknown;
      await client.query('select public.close_period($1, $2, $3)', [
        p.id,
        JSON.stringify(snapshot),
        JSON.stringify(closingCarry(report)),
      ]);
      return report.settlement.sumSettled.toFixed(0);
    });
    console.log(`${DRY_RUN ? '[dry run] would close' : 'closed'} ${p.name} ${p.month} · ৳${total}`);
  }
}

function mailer() {
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  if (!user || !pass) return null;
  return {
    from: `"${env.MAIL_FROM_NAME ?? 'Light House'}" <${user}>`,
    transport: nodemailer.createTransport({
      host: env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(env.SMTP_PORT ?? 465),
      secure: Number(env.SMTP_PORT ?? 465) === 465,
      auth: { user, pass },
    }),
  };
}

/** Closed months (last month or newer) whose report has not gone out yet. */
async function emailClosedMonths(): Promise<boolean> {
  const { rows } = await client.query<PeriodRow>(
    `select p.id, p.mess_id, to_char(p.month, 'YYYY-MM-DD') as month, m.name
     from public.periods p
     join public.messes m on m.id = p.mess_id
     where p.status = 'closed' and p.emailed_at is null and m.deleted_at is null
       and p.month >= (date_trunc('month', now() at time zone m.timezone) - interval '1 month')::date
     order by p.month`,
  );
  if (rows.length === 0) {
    console.log('no month reports waiting to be emailed');
    return true;
  }
  const mail = mailer();
  if (!mail) {
    console.log(
      `::warning::${rows.length} month report(s) waiting, but SMTP_USER / SMTP_PASS are not set`,
    );
    return false;
  }

  let ok = true;
  for (const p of rows) {
    const actor = await actorFor(p.mess_id);
    if (!actor) continue;
    const { report, contacts } = await asUser(actor, async () => ({
      report: reportOf(await bundleOf(p.mess_id, p.id)),
      contacts: (
        await client.query<{ member_id: string; display_name: string; email: string }>(
          'select * from public.member_contacts($1)',
          [p.mess_id],
        )
      ).rows,
    }));
    const month = formatMonth(p.month);
    const link = `${APP_URL}#/report?period=${p.id}`;
    let sent = 0;
    for (const c of contacts) {
      const email = buildMemberEmail(report, c.member_id, { messName: p.name, month, link });
      if (!email) continue;
      if (DRY_RUN) {
        console.log(`[dry run] would email ${c.display_name}: ${email.subject}`);
        continue;
      }
      try {
        await mail.transport.sendMail({
          from: mail.from,
          to: `"${c.display_name.replace(/"/g, '')}" <${c.email}>`,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
        sent += 1;
      } catch (err) {
        ok = false;
        console.log(
          `::error::email to ${c.display_name} for ${p.name} ${month} failed: ${String(err)}`,
        );
      }
    }
    // Only mark the month when everyone got it; a failed run retries tomorrow.
    if (!DRY_RUN && sent === contacts.length) {
      await client.query('update public.periods set emailed_at = now() where id = $1', [p.id]);
    }
    console.log(`${p.name} ${month}: emailed ${sent}/${contacts.length}`);
  }
  return ok;
}

async function main() {
  await client.connect();
  try {
    if (DRY_RUN) console.log('DRY RUN: nothing is written or sent');
    await closeEndedMonths();
    const ok = await emailClosedMonths();
    if (!ok) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await main();
