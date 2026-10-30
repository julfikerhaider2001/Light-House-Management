-- Storage policies for profile photos and receipts.
--   Ayman and Saad share a mess; X is an outsider.
begin;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated;
create table tests.kv (k text primary key, v text not null);
grant select, insert on tests.kv to authenticated;
create function tests.id(p_k text) returns uuid language sql stable
as $$ select v::uuid from tests.kv where k = p_k $$;
create function tests.val(p_k text) returns text language sql stable
as $$ select v from tests.kv where k = p_k $$;
create function tests.login(p_k text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p_k), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
grant execute on all functions in schema tests to authenticated;

insert into tests.kv values
  ('ayman', '11111111-1111-4111-8111-111111111111'),
  ('saad', '22222222-2222-4222-8222-222222222222'),
  ('x', '44444444-4444-4444-8444-444444444444');
insert into auth.users (id, email)
select v::uuid, k || '@test.local' from tests.kv;

select tests.login('ayman');
insert into tests.kv select 'mess', public.create_mess('Mess A') ->> 'mess_id';
insert into tests.kv select 'code', invite_code from public.messes where id = tests.id('mess');
select tests.login('saad');
select public.join_mess(tests.val('code'));

-- ---------------------------------------------------------------------------
-- Profile photos
-- ---------------------------------------------------------------------------
select tests.login('ayman');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', tests.val('ayman') || '/me.webp', tests.val('ayman')) $$,
  'a user uploads a photo into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', tests.val('saad') || '/fake.webp', tests.val('ayman')) $$,
  '42501',
  null,
  'nobody uploads into someone else''s folder'
);
select lives_ok(
  $$ update public.profiles set avatar_path = tests.val('ayman') || '/me.webp'
     where id = tests.id('ayman') $$,
  'a user records their own photo path'
);
select throws_ok(
  $$ update public.profiles set avatar_path = '../../etc/passwd' where id = tests.id('ayman') $$,
  '23514',
  null,
  'photo paths are constrained to <user_id>/<file>'
);

select tests.login('saad');
select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'
     and name = tests.val('ayman') || '/me.webp'),
  1::bigint,
  'mess-mates can see each other''s photos'
);
select is(
  (select count(*) from jsonb_array_elements(public.get_period_bundle(tests.id('mess')) -> 'avatars')),
  1::bigint,
  'the bundle includes mess-mates'' photo paths'
);

select tests.login('x');
select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'
     and name = tests.val('ayman') || '/me.webp'),
  0::bigint,
  'outsiders cannot see photos'
);

-- ---------------------------------------------------------------------------
-- Receipts
-- ---------------------------------------------------------------------------
select tests.login('saad');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('receipts', tests.val('mess') || '/r1.webp', tests.val('saad')) $$,
  'an active member uploads a receipt under the mess folder'
);
select tests.login('x');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('receipts', tests.val('mess') || '/r2.webp', tests.val('x')) $$,
  '42501',
  null,
  'outsiders cannot upload receipts into a mess'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'receipts'),
  0::bigint,
  'outsiders cannot see a mess''s receipts'
);
select tests.login('ayman');
select is(
  (select count(*) from storage.objects where bucket_id = 'receipts'),
  1::bigint,
  'members can see their mess''s receipts'
);

select * from finish();
rollback;
