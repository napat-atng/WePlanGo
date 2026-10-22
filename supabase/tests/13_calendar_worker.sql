begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(1);
insert into auth.users(id) values
  ('00000000-0000-0000-0000-00000000e501'),
  ('00000000-0000-0000-0000-00000000e502'),
  ('00000000-0000-0000-0000-00000000e503'),
  ('00000000-0000-0000-0000-00000000e504');
insert into public.profiles(user_id,display_name)
select id,'Worker fixture' from auth.users where id in(
  '00000000-0000-0000-0000-00000000e501','00000000-0000-0000-0000-00000000e502',
  '00000000-0000-0000-0000-00000000e503','00000000-0000-0000-0000-00000000e504');
insert into public.calendar_account_status(user_id,connected,last_synced_at,last_attempt_at) values
  ('00000000-0000-0000-0000-00000000e501',true,null,null),
  ('00000000-0000-0000-0000-00000000e502',true,null,now()),
  ('00000000-0000-0000-0000-00000000e503',true,now()-interval '1 day',now()-interval '1 day'),
  ('00000000-0000-0000-0000-00000000e504',true,now(),now());
set local role service_role;
do $$
declare users uuid[];
begin
  select array_agg(user_id) into users from public.calendar_pending_users()
    where user_id in('00000000-0000-0000-0000-00000000e501','00000000-0000-0000-0000-00000000e502','00000000-0000-0000-0000-00000000e503','00000000-0000-0000-0000-00000000e504');
  if users is distinct from array['00000000-0000-0000-0000-00000000e501','00000000-0000-0000-0000-00000000e503','00000000-0000-0000-0000-00000000e502']::uuid[] then
    raise exception 'Failed account starved older or unattempted work, or fresh account selected';
  end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000e501',true);
select public.calendar_command('connect',jsonb_build_object('tokens',repeat('encrypted-test-only',4)));
select public.calendar_command('claim');
do $$
begin
  if not exists(select 1 from public.calendar_account_status where user_id=auth.uid() and last_attempt_at is not null and lease_id is not null) then
    raise exception 'Claim failed to stamp attempt time';
  end if;
end $$;
reset role;
select pass('Worker fairness, fresh account exclusion and attempt stamping');
select * from finish();
rollback;
