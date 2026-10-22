begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000111', 'Participants test', '00000000-0000-0000-0000-0000000000a1');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000b2');
insert into public.trips (id, group_id, organizer_id, title, vote_deadline) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Participants test', now() + interval '1 day');

set local role authenticated;

do $$
declare
  changed_count integer;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  begin
    perform public.respond_to_trip_invitation('00000000-0000-0000-0000-000000000222','declined');
    -- RLS may reject with an exception or filter the UPDATE to zero rows.
    if exists(select 1 from public.trip_participants
      where trip_id='00000000-0000-0000-0000-000000000222'
        and user_id='00000000-0000-0000-0000-0000000000a1'
        and invitation_status='declined') then
      raise exception 'organizer declined own trip';
    end if;
  exception when insufficient_privilege then null;
  end;
  insert into public.trip_participants (trip_id, user_id, invitation_status) values
    ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-0000000000b2', 'pending');

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  perform public.respond_to_trip_invitation('00000000-0000-0000-0000-000000000222','declined');
  select count(*) into changed_count from public.trip_participants
    where trip_id='00000000-0000-0000-0000-000000000222'
      and user_id='00000000-0000-0000-0000-0000000000b2' and invitation_status='declined';
  if changed_count <> 1 then raise exception 'invitee could not decline'; end if;
  perform public.respond_to_trip_invitation('00000000-0000-0000-0000-000000000222','interested');
  select count(*) into changed_count from public.trip_participants
    where trip_id='00000000-0000-0000-0000-000000000222'
      and user_id='00000000-0000-0000-0000-0000000000b2' and invitation_status='interested';
  if changed_count <> 1 then raise exception 'invitee could not rejoin'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  select count(*) into changed_count from public.trip_participants;
  if changed_count <> 0 then raise exception 'outsider read participants'; end if;
  begin
    insert into public.trip_participants (trip_id, user_id, invitation_status) values
      ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-0000000000c3', 'pending');
    raise exception 'outsider added participant';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  delete from public.trip_participants
    where trip_id = '00000000-0000-0000-0000-000000000222'
      and user_id = '00000000-0000-0000-0000-0000000000b2';
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then raise exception 'organizer could not remove invitee'; end if;
end;
$$;

reset role;
select pass('03_participants assertions');
select * from finish();
rollback;
