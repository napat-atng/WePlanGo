begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000111', 'Completion test', '00000000-0000-0000-0000-0000000000a1');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000b2');
insert into public.trips (id, group_id, organizer_id, title, vote_deadline) values
  ('00000000-0000-0000-0000-000000000221', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Future trip', now() + interval '1 day'),
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Past trip', now() + interval '1 day');
-- Historical fixture only: this transaction predates the future-date guard.
-- Restore the guard before any authenticated behavior is exercised.
alter table public.date_options disable trigger date_options_future_guard;
insert into public.date_options (id, trip_id, starts_on, ends_on, created_by) values
  ('00000000-0000-0000-0000-000000000331', '00000000-0000-0000-0000-000000000221',
   current_date + 1, current_date + 1, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000332', '00000000-0000-0000-0000-000000000222',
   current_date - 1, current_date - 1, '00000000-0000-0000-0000-0000000000a1');
alter table public.date_options enable trigger date_options_future_guard;
insert into public.place_options (id, trip_id, name, created_by) values
  ('00000000-0000-0000-0000-000000000441', '00000000-0000-0000-0000-000000000221', 'Park', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000442', '00000000-0000-0000-0000-000000000222', 'Park', '00000000-0000-0000-0000-0000000000a1');

-- Set historical confirmed fixtures without changing the database clock.
update public.trips set status = 'confirmed', plan_version = 1, meeting_point = 'Entrance',
  selected_date_option_id = '00000000-0000-0000-0000-000000000331',
  selected_place_option_id = '00000000-0000-0000-0000-000000000441',
  meeting_at = ((current_date + 1) + time '10:00') at time zone 'Asia/Bangkok'
  where id = '00000000-0000-0000-0000-000000000221';
update public.trips set status = 'confirmed', plan_version = 1, meeting_point = 'Entrance',
  selected_date_option_id = '00000000-0000-0000-0000-000000000332',
  selected_place_option_id = '00000000-0000-0000-0000-000000000442',
  meeting_at = ((current_date - 1) + time '10:00') at time zone 'Asia/Bangkok'
  where id = '00000000-0000-0000-0000-000000000222';

set local role authenticated;
do $$
begin
  begin
    perform public.complete_trip('00000000-0000-0000-0000-000000000221');
    raise exception 'future trip completed';
  exception when invalid_parameter_value then null;
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  begin
    perform public.complete_trip('00000000-0000-0000-0000-000000000222');
    raise exception 'member completed another organizer trip';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  perform public.complete_trip('00000000-0000-0000-0000-000000000222');
  if not exists (select 1 from public.trips
    where id = '00000000-0000-0000-0000-000000000222' and status = 'completed') then
    raise exception 'past trip did not complete';
  end if;
  begin
    perform public.submit_rsvp('00000000-0000-0000-0000-000000000222', 'going');
    raise exception 'completed trip accepted RSVP';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
select pass('completed trip permissions and timing');
select * from finish();
rollback;
