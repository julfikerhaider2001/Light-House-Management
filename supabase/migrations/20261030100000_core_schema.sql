-- Core schema: messes, members, periods and everything recorded inside a period.
-- Every mess-scoped table carries mess_id so RLS and realtime filters need no joins.

create type public.member_role as enum ('manager', 'member');
create type public.member_status as enum ('active', 'left');
create type public.period_status as enum ('open', 'closed');
create type public.expense_kind as enum ('bazar', 'initial');
create type public.bill_kind as enum (
  'khala', 'house_rent', 'wifi', 'gas', 'electricity', 'extra', 'other'
);
create type public.payment_method as enum ('cash', 'bkash', 'nagad', 'bank');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- 8 chars from an alphabet without look-alikes (no 0/O, 1/I/L).
create function public.gen_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

-- Itemised expenses ("murgi-230", "chal+milk-90") must add up to the expense amount.
create function public.expense_items_valid(items jsonb, total numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(items) <> 'array' then false
    when jsonb_array_length(items) = 0 then true
    else (
      select bool_and(
               jsonb_typeof(i -> 'name') = 'string'
               and length(trim(i ->> 'name')) > 0
               and jsonb_typeof(i -> 'amount') = 'number'
               and (i ->> 'amount')::numeric > 0
             )
             and sum(case when jsonb_typeof(i -> 'amount') = 'number'
                          then (i ->> 'amount')::numeric end) = total
      from jsonb_array_elements(items) as i
    )
  end;
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  phone text check (phone is null or phone ~ '^\+?[0-9 -]{6,20}$'),
  created_at timestamptz not null default now()
);

create table public.messes (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Light House' check (length(trim(name)) between 1 and 60),
  currency text not null default 'BDT',
  timezone text not null default 'Asia/Dhaka',
  invite_code text not null unique default public.gen_invite_code(),
  meal_cutoff_time time not null default '22:00',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.mess_members (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null references public.messes (id) on delete cascade,
  -- Null for a placeholder the manager added before the person signed up.
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  role public.member_role not null default 'member',
  status public.member_status not null default 'active',
  joined_on date not null default (now() at time zone 'Asia/Dhaka')::date,
  left_on date,
  created_at timestamptz not null default now(),
  unique (mess_id, user_id),
  unique (id, mess_id),
  check ((status = 'left') = (left_on is not null))
);
create unique index mess_members_name_uq on public.mess_members (mess_id, lower(display_name));

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null references public.messes (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  status public.period_status not null default 'open',
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  snapshot jsonb,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  unique (mess_id, month),
  unique (id, mess_id),
  check ((status = 'closed') = (closed_at is not null))
);
-- One current open period per mess. A reopened past month (for corrections) is not "current".
create unique index periods_one_open_uq on public.periods (mess_id)
  where status = 'open' and reopened_at is null;

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null,
  period_id uuid not null,
  member_id uuid not null,
  date date not null,
  meals numeric(4, 1) not null check (meals >= 0 and meals <= 20 and mod(meals * 2, 1) = 0),
  note text check (note is null or length(note) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (member_id, date),
  foreign key (period_id, mess_id) references public.periods (id, mess_id) on delete cascade,
  foreign key (member_id, mess_id) references public.mess_members (id, mess_id) on delete cascade
);
create index meal_entries_period_idx on public.meal_entries (period_id);
create index meal_entries_mess_idx on public.meal_entries (mess_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null,
  period_id uuid not null,
  member_id uuid not null, -- who paid
  date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  kind public.expense_kind not null default 'bazar',
  items jsonb not null default '[]'::jsonb,
  receipt_path text,
  note text check (note is null or length(note) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_items_sum check (public.expense_items_valid(items, amount)),
  foreign key (period_id, mess_id) references public.periods (id, mess_id) on delete cascade,
  foreign key (member_id, mess_id) references public.mess_members (id, mess_id) on delete cascade
);
create index expenses_period_idx on public.expenses (period_id);
create index expenses_mess_idx on public.expenses (mess_id);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null,
  period_id uuid not null,
  kind public.bill_kind not null,
  label text check (label is null or length(label) <= 60),
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (period_id, mess_id) references public.periods (id, mess_id) on delete cascade
);
create index bills_period_idx on public.bills (period_id);
create index bills_mess_idx on public.bills (mess_id);

create table public.rent_shares (
  mess_id uuid not null,
  period_id uuid not null,
  member_id uuid not null,
  fixed_amount numeric(12, 2) check (fixed_amount is null or fixed_amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (period_id, member_id),
  foreign key (period_id, mess_id) references public.periods (id, mess_id) on delete cascade,
  foreign key (member_id, mess_id) references public.mess_members (id, mess_id) on delete cascade
);
create index rent_shares_mess_idx on public.rent_shares (mess_id);

create table public.previous_dues (
  mess_id uuid not null,
  period_id uuid not null,
  member_id uuid not null,
  amount numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (period_id, member_id),
  foreign key (period_id, mess_id) references public.periods (id, mess_id) on delete cascade,
  foreign key (member_id, mess_id) references public.mess_members (id, mess_id) on delete cascade
);
create index previous_dues_mess_idx on public.previous_dues (mess_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  mess_id uuid not null,
  period_id uuid not null,
  member_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  date date not null,
  note text check (note is null or length(note) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (period_id, mess_id) references public.periods (id, mess_id) on delete cascade,
  foreign key (member_id, mess_id) references public.mess_members (id, mess_id) on delete cascade
);
create index payments_period_idx on public.payments (period_id);
create index payments_mess_idx on public.payments (mess_id);

create table public.activity_log (
  id bigint generated always as identity primary key,
  mess_id uuid not null references public.messes (id) on delete cascade,
  actor uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_mess_created_idx on public.activity_log (mess_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

create trigger meal_entries_touch before update on public.meal_entries
  for each row execute function public.touch_updated_at();
create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();
create trigger bills_touch before update on public.bills
  for each row execute function public.touch_updated_at();
create trigger rent_shares_touch before update on public.rent_shares
  for each row execute function public.touch_updated_at();
create trigger previous_dues_touch before update on public.previous_dues
  for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- A closed period is read-only for everyone, including security-definer code paths.
create function public.guard_closed_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched uuid[];
begin
  if tg_op in ('INSERT', 'UPDATE') then
    touched := array[new.period_id];
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    touched := coalesce(touched, '{}') || old.period_id;
  end if;
  if exists (select 1 from public.periods p where p.id = any (touched) and p.status = 'closed') then
    raise exception 'This month is closed. Ask the manager to reopen it.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger meal_entries_guard_closed before insert or update or delete on public.meal_entries
  for each row execute function public.guard_closed_period();
create trigger expenses_guard_closed before insert or update or delete on public.expenses
  for each row execute function public.guard_closed_period();
create trigger bills_guard_closed before insert or update or delete on public.bills
  for each row execute function public.guard_closed_period();
create trigger rent_shares_guard_closed before insert or update or delete on public.rent_shares
  for each row execute function public.guard_closed_period();
create trigger previous_dues_guard_closed before insert or update or delete on public.previous_dues
  for each row execute function public.guard_closed_period();
create trigger payments_guard_closed before insert or update or delete on public.payments
  for each row execute function public.guard_closed_period();

-- Dated rows must fall inside their period's month.
create function public.guard_date_in_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.periods p
    where p.id = new.period_id and date_trunc('month', new.date)::date = p.month
  ) then
    raise exception 'Date % is outside this month', new.date using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger meal_entries_date_in_period before insert or update of date, period_id on public.meal_entries
  for each row execute function public.guard_date_in_period();
create trigger expenses_date_in_period before insert or update of date, period_id on public.expenses
  for each row execute function public.guard_date_in_period();
create trigger payments_date_in_period before insert or update of date, period_id on public.payments
  for each row execute function public.guard_date_in_period();

-- ---------------------------------------------------------------------------
-- Activity log: every insert/update/delete on mess data, written by trigger.
-- ---------------------------------------------------------------------------

create function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  old_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  row_data jsonb := coalesce(new_row, old_row);
  act text := lower(tg_op);
  target_mess uuid := case when tg_table_name = 'messes' then (row_data ->> 'id')::uuid
                           else (row_data ->> 'mess_id')::uuid end;
begin
  -- Rows removed by a mess-level cascade have nowhere to be logged.
  if not exists (select 1 from public.messes m where m.id = target_mess) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    if old_row ->> 'deleted_at' is null and new_row ->> 'deleted_at' is not null then
      act := 'delete';
    elsif old_row ->> 'deleted_at' is not null and new_row ->> 'deleted_at' is null then
      act := 'restore';
    end if;
  end if;

  insert into public.activity_log (mess_id, actor, action, entity, entity_id, payload)
  values (
    target_mess,
    auth.uid(),
    act,
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'member_id'),
    jsonb_strip_nulls(jsonb_build_object('new', new_row, 'old', old_row))
  );
  return coalesce(new, old);
end;
$$;

create trigger meal_entries_log after insert or update or delete on public.meal_entries
  for each row execute function public.log_activity();
create trigger expenses_log after insert or update or delete on public.expenses
  for each row execute function public.log_activity();
create trigger bills_log after insert or update or delete on public.bills
  for each row execute function public.log_activity();
create trigger rent_shares_log after insert or update or delete on public.rent_shares
  for each row execute function public.log_activity();
create trigger previous_dues_log after insert or update or delete on public.previous_dues
  for each row execute function public.log_activity();
create trigger payments_log after insert or update or delete on public.payments
  for each row execute function public.log_activity();
create trigger mess_members_log after insert or update or delete on public.mess_members
  for each row execute function public.log_activity();
create trigger periods_log after insert or update on public.periods
  for each row execute function public.log_activity();
create trigger messes_log after insert or update on public.messes
  for each row execute function public.log_activity();

-- ---------------------------------------------------------------------------
-- Profiles are created with the auth user.
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    ), 60)
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
