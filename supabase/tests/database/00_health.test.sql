begin;
select plan(4);

select has_function('public', 'health', 'health() exists');

select is(
  public.health() ->> 'status',
  'healthy',
  'health() reports healthy'
);

select ok(
  (public.health() ->> 'version') is not null,
  'health() reports the latest migration version'
);

set local role anon;
select is(
  public.health() ->> 'status',
  'healthy',
  'anon can call health()'
);

select * from finish();
rollback;
