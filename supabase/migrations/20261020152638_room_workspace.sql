-- The new workspace is one room per trip. Legacy IDs and source rows are kept.
create table public.trip_rooms (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(user_id),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 1000),
  starts_on date not null,
  ends_on date not null,
  vote_deadline timestamptz not null,
  timezone text not null default 'Asia/Bangkok',
  status text not null default 'planning' check (status in ('planning','closed','confirmed','completed','cancelled')),
  selected_date date,
  selected_place_id uuid,
  plan_version integer not null default 0 check (plan_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 730),
  check (status <> 'confirmed' or (selected_date is not null and selected_place_id is not null and plan_version > 0))
);
create table public.room_members (
  room_id uuid not null references public.trip_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(), primary key(room_id,user_id)
);
create table public.room_bans (
  room_id uuid not null references public.trip_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(), primary key(room_id,user_id)
);
create table public.room_invites (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.trip_rooms(id) on delete cascade,
  token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null, revoked_at timestamptz,
  created_at timestamptz not null default now(), unique(room_id,token_hash)
);
create index room_invites_hash_idx on public.room_invites(token_hash);
create table public.room_places (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.trip_rooms(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 160),
  detail text not null default '' check(length(detail)<=1000),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(), unique(room_id,id)
);
alter table public.trip_rooms add constraint room_selected_place_same_room
  foreign key(id,selected_place_id) references public.room_places(room_id,id) deferrable initially deferred;
create table public.room_votes (
  room_id uuid not null, place_id uuid not null, user_id uuid not null,
  created_at timestamptz not null default now(), primary key(place_id,user_id),
  foreign key(room_id,place_id) references public.room_places(room_id,id) on delete cascade,
  foreign key(room_id,user_id) references public.room_members(room_id,user_id) on delete cascade
);
create index room_votes_member_idx on public.room_votes(room_id,user_id);
create table public.room_rsvps (
  room_id uuid not null, user_id uuid not null, plan_version integer not null check(plan_version>0),
  response text not null check(response in ('going','not_going')),
  updated_at timestamptz not null default now(), primary key(room_id,user_id,plan_version),
  foreign key(room_id,user_id) references public.room_members(room_id,user_id) on delete cascade
);
create table public.room_messages (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.trip_rooms(id) on delete cascade,
  author_id uuid references public.profiles(user_id) on delete set null,
  body text not null check(length(trim(body)) between 1 and 2000),
  kind text not null default 'message' check(kind in ('message','system')),
  created_at timestamptz not null default now()
);
create index room_messages_history_idx on public.room_messages(room_id,created_at desc,id);
create table public.profile_availability (
  user_id uuid not null references public.profiles(user_id) on delete cascade, day date not null,
  answer text not null check(answer in ('free','busy')), updated_at timestamptz not null default now(), primary key(user_id,day)
);
create table public.calendar_account_status (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  connected boolean not null default false, last_synced_at timestamptz, error text,
  lease_until timestamptz, lease_id uuid
);
create table public.calendar_busy_periods (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(user_id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, check(ends_at>starts_at)
);
create index calendar_busy_user_idx on public.calendar_busy_periods(user_id,starts_at,ends_at);
-- Kept after room deletion, so queued external-event removals are not lost.
create table public.calendar_event_jobs (
  user_id uuid not null references public.profiles(user_id) on delete cascade, room_id uuid not null,
  event_id text not null default replace(gen_random_uuid()::text,'-',''),
  payload jsonb, revision integer not null default 1,
  synced_revision integer not null default 0, attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(), last_error text,
  primary key(user_id,room_id)
);
create table private.calendar_credentials (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  encrypted_tokens text not null, updated_at timestamptz not null default now()
);
revoke all on private.calendar_credentials from public,anon,authenticated;
create index room_members_user_idx on public.room_members(user_id,room_id);
create index room_bans_user_idx on public.room_bans(user_id);
create index trip_rooms_organizer_idx on public.trip_rooms(organizer_id);
create index room_places_author_idx on public.room_places(created_by);
create index room_messages_author_idx on public.room_messages(author_id);
create index trip_rooms_selected_idx on public.trip_rooms(id,selected_place_id);

create function private.room_member(p_room uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.room_members where room_id=p_room and user_id=auth.uid())
$$;
create function private.room_owner(p_room uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.trip_rooms where id=p_room and organizer_id=auth.uid())
$$;
revoke all on function private.room_member(uuid),private.room_owner(uuid) from public,anon;
grant execute on function private.room_member(uuid),private.room_owner(uuid) to authenticated;

do $$ declare t text; begin
  foreach t in array array['trip_rooms','room_members','room_bans','room_invites','room_places','room_votes','room_rsvps','room_messages','profile_availability','calendar_account_status','calendar_busy_periods','calendar_event_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
create policy rooms_read on public.trip_rooms for select to authenticated using(private.room_member(id));
create policy members_read on public.room_members for select to authenticated using(private.room_member(room_id));
create policy bans_read on public.room_bans for select to authenticated using(private.room_owner(room_id));
create policy invites_read on public.room_invites for select to authenticated using(private.room_owner(room_id));
create policy places_read on public.room_places for select to authenticated using(private.room_member(room_id));
create policy votes_read on public.room_votes for select to authenticated using(private.room_member(room_id));
create policy rsvps_read on public.room_rsvps for select to authenticated using(private.room_member(room_id));
create policy messages_read on public.room_messages for select to authenticated using(private.room_member(room_id));
create policy availability_own on public.profile_availability for select to authenticated using(user_id=(select auth.uid()));
create policy calendar_status_own on public.calendar_account_status for select to authenticated using(user_id=(select auth.uid()));
create policy calendar_busy_own on public.calendar_busy_periods for select to authenticated using(user_id=(select auth.uid()));
create policy calendar_jobs_own on public.calendar_event_jobs for select to authenticated using(user_id=(select auth.uid()));
create policy profiles_room_read on public.profiles for select to authenticated using(
  exists(select 1 from public.room_members a join public.room_members b using(room_id) where a.user_id=(select auth.uid()) and b.user_id=profiles.user_id)
);

-- Read only availability states for other members, never event titles or periods.
create function private.room_availability(p_room uuid,p_start date,p_end date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.room_member(p_room) then raise exception 'Not a room member' using errcode='42501'; end if;
  if p_end<p_start or p_end-p_start>62 then raise exception 'Invalid calendar range' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'day',d.day::date,'answer',
    case when exists(select 1 from public.calendar_busy_periods b where b.user_id=m.user_id
      and b.starts_at < ((d.day::date+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at > (d.day::timestamp at time zone 'Asia/Bangkok'))
      or exists(select 1 from public.room_rsvps r join public.trip_rooms t on t.id=r.room_id
        where r.user_id=m.user_id and r.response='going' and r.plan_version=t.plan_version and t.status='confirmed' and t.selected_date=d.day::date)
      then 'busy' else a.answer end)), '[]'::jsonb) into result
  from public.room_members m cross join generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d(day)
    left join public.profile_availability a on a.user_id=m.user_id and a.day=d.day::date where m.room_id=p_room;
  return result;
end $$;
create function public.room_availability(p_room uuid,p_start date,p_end date) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.room_availability(p_room,p_start,p_end) $$;
revoke all on function public.room_availability(uuid,date,date),private.room_availability(uuid,date,date) from public,anon;
grant execute on function public.room_availability(uuid,date,date),private.room_availability(uuid,date,date) to authenticated;

create function private.queue_room_calendar(p_room uuid,p_user uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  -- Clear withdrawn/revised/deleted plans without losing the external event ID.
  update public.calendar_event_jobs j set payload=null,revision=revision+1,attempts=0,next_attempt_at=now()
  where j.room_id=p_room and (p_user is null or j.user_id=p_user) and j.payload is not null;
  insert into public.calendar_event_jobs(user_id,room_id,payload)
  select r.user_id,t.id,jsonb_build_object('title',t.title,'date',t.selected_date,'place',p.name,'timezone',t.timezone,'version',t.plan_version)
  from public.trip_rooms t join public.room_rsvps r on r.room_id=t.id and r.plan_version=t.plan_version and r.response='going'
    join public.room_places p on p.id=t.selected_place_id
  where t.id=p_room and t.status='confirmed' and (p_user is null or r.user_id=p_user)
  on conflict(user_id,room_id) do update set payload=excluded.payload,revision=calendar_event_jobs.revision+1,attempts=0,next_attempt_at=now();
end $$;
revoke all on function private.queue_room_calendar(uuid,uuid) from public,anon,authenticated;

create function private.room_command(p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); rid uuid; target uuid; place uuid; r public.trip_rooms; token text; chosen date; max_votes bigint; count_votes bigint; result jsonb;
begin
  if u is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_action='profile' then
    if length(trim(p->>'name')) not between 1 and 120 then raise exception 'Invalid name' using errcode='22023'; end if;
    if p ? 'avatar' and p->>'avatar' is not null and p->>'avatar' !~ '^https://' then raise exception 'Invalid avatar' using errcode='22023'; end if;
    update public.profiles set display_name=trim(p->>'name'),avatar_url=case when p ? 'avatar' then p->>'avatar' else avatar_url end,updated_at=now() where user_id=u;
    return '{}'::jsonb;
  elsif p_action='availability' then
    chosen:=(p->>'day')::date;
    if chosen is null or chosen<current_date-365 or chosen>current_date+1095 then raise exception 'Invalid day' using errcode='22023'; end if;
    if p ? 'room' and not private.room_member((p->>'room')::uuid) then raise exception 'Not a room member' using errcode='42501'; end if;
    if p->>'answer'='unset' then delete from public.profile_availability where user_id=u and day=chosen;
    else
      if p->>'answer' not in ('free','busy') or p->>'answer' is null then raise exception 'Invalid availability' using errcode='22023'; end if;
      insert into public.profile_availability(user_id,day,answer) values(u,chosen,p->>'answer') on conflict(user_id,day) do update set answer=excluded.answer,updated_at=now();
    end if;
    return '{}'::jsonb;
  elsif p_action='create' then
    if (p->>'start')::date<current_date or (p->>'end')::date>current_date+730 then raise exception 'Invalid trip range' using errcode='22023'; end if;
    if (p->>'deadline')::timestamptz<=now() or (p->>'deadline') is null then raise exception 'Deadline must be in the future' using errcode='22023'; end if;
    insert into public.trip_rooms(organizer_id,title,description,starts_on,ends_on,vote_deadline)
      values(u,trim(p->>'title'),coalesce(p->>'description',''),(p->>'start')::date,(p->>'end')::date,(p->>'deadline')::timestamptz) returning * into r;
    insert into public.room_members(room_id,user_id) values(r.id,u);
    return jsonb_build_object('id',r.id);
  elsif p_action='preview' then
    select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'valid',i.revoked_at is null and i.expires_at>now() and t.status not in ('cancelled','completed') and not exists(select 1 from public.room_bans b where b.room_id=t.id and b.user_id=u))),'[]'::jsonb) into result
      from public.room_invites i join public.trip_rooms t on t.id=i.room_id where i.token_hash=encode(extensions.digest(p->>'token','sha256'),'hex');
    return result;
  end if;
  rid:=(p->>'room')::uuid;
  select * into r from public.trip_rooms where id=rid for update;
  if not found then raise exception 'Room not found' using errcode='P0002'; end if;
  if p_action='join' then
    if exists(select 1 from public.room_bans where room_id=rid and user_id=u) then raise exception 'You are banned from this room' using errcode='42501'; end if;
    if r.status in ('cancelled','completed') or not exists(select 1 from public.room_invites where room_id=rid and token_hash=encode(extensions.digest(p->>'token','sha256'),'hex') and revoked_at is null and expires_at>now()) then raise exception 'Invitation expired or revoked' using errcode='22023'; end if;
    insert into public.room_members(room_id,user_id) values(rid,u) on conflict do nothing;
    return jsonb_build_object('id',rid);
  end if;
  if not private.room_member(rid) then raise exception 'Not a room member' using errcode='42501'; end if;
  if p_action in ('invite','revoke_invites','close','confirm','kick','ban','unban','delete') and r.organizer_id<>u then raise exception 'Organizer only' using errcode='42501'; end if;
  if p_action='invite' then
    token:=encode(extensions.gen_random_bytes(24),'hex');
    update public.room_invites set revoked_at=now() where room_id=rid and revoked_at is null;
    insert into public.room_invites(room_id,token_hash,expires_at) values(rid,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '30 days');
    return jsonb_build_object('token',token);
  elsif p_action='revoke_invites' then
    update public.room_invites set revoked_at=now() where room_id=rid and revoked_at is null;
  elsif p_action in ('propose','vote') then
    if r.status<>'planning' or r.vote_deadline<=now() then raise exception 'Voting is closed' using errcode='22023'; end if;
    if p_action='propose' then
      insert into public.room_places(room_id,name,detail,created_by) values(rid,trim(p->>'name'),coalesce(p->>'detail',''),u) returning id into place;
      return jsonb_build_object('id',place);
    end if;
    place:=(p->>'place')::uuid;
    if not exists(select 1 from public.room_places where id=place and room_id=rid) then raise exception 'Invalid place' using errcode='22023'; end if;
    if coalesce((p->>'selected')::boolean,false) then insert into public.room_votes(room_id,place_id,user_id) values(rid,place,u) on conflict do nothing;
    else delete from public.room_votes where room_id=rid and place_id=place and user_id=u; end if;
  elsif p_action='close' then
    if r.status<>'planning' then raise exception 'Cannot close this room' using errcode='22023'; end if;
    update public.trip_rooms set status='closed',updated_at=now() where id=rid;
  elsif p_action='confirm' then
    if r.status not in ('planning','closed','confirmed') or (r.status='planning' and r.vote_deadline>now()) then raise exception 'Close voting first' using errcode='22023'; end if;
    chosen:=(p->>'date')::date; place:=(p->>'place')::uuid;
    if chosen is null or chosen<r.starts_on or chosen>r.ends_on or chosen<(now() at time zone r.timezone)::date then raise exception 'Invalid trip date' using errcode='22023'; end if;
    select max(c) into max_votes from (select count(v.user_id) c from public.room_places x left join public.room_votes v on v.place_id=x.id where x.room_id=rid group by x.id) x;
    select count(*) into count_votes from public.room_votes where room_id=rid and place_id=place;
    if coalesce(max_votes,0)=0 or count_votes<>max_votes or not exists(select 1 from public.room_places where id=place and room_id=rid) then raise exception 'Choose a winning place' using errcode='22023'; end if;
    update public.trip_rooms set status='confirmed',selected_date=chosen,selected_place_id=place,plan_version=plan_version+1,updated_at=now() where id=rid;
    perform private.queue_room_calendar(rid);
    insert into public.room_messages(room_id,kind,body) values(rid,'system','ยืนยันแผนรุ่น '||(r.plan_version+1)||' · '||chosen::text);
  elsif p_action='rsvp' then
    if r.status<>'confirmed' or p->>'version' is null or (p->>'version')::integer<>r.plan_version then raise exception 'Plan changed; refresh before responding' using errcode='22023'; end if;
    if p->>'response' not in ('going','not_going') or p->>'response' is null then raise exception 'Invalid RSVP' using errcode='22023'; end if;
    insert into public.room_rsvps(room_id,user_id,plan_version,response) values(rid,u,r.plan_version,p->>'response') on conflict(room_id,user_id,plan_version) do update set response=excluded.response,updated_at=now();
    perform private.queue_room_calendar(rid,u);
  elsif p_action='message' then
    if r.status in ('cancelled','completed') then raise exception 'Room is archived' using errcode='22023'; end if;
    if exists(select 1 from public.room_messages where author_id=u and created_at>now()-interval '1 second') then raise exception 'Please wait before sending again' using errcode='22023'; end if;
    insert into public.room_messages(room_id,author_id,body) values(rid,u,trim(p->>'body'));
  elsif p_action in ('kick','ban','unban') then
    target:=(p->>'user')::uuid;
    if target is null or target=r.organizer_id then raise exception 'Cannot remove organizer' using errcode='22023'; end if;
    if p_action='unban' then delete from public.room_bans where room_id=rid and user_id=target;
    else
      delete from public.room_members where room_id=rid and user_id=target;
      perform private.queue_room_calendar(rid,target);
      if p_action='ban' then insert into public.room_bans(room_id,user_id) values(rid,target) on conflict do nothing; end if;
    end if;
  elsif p_action='delete' then
    -- Queue removals before cascading the room rows. Historical source rows remain.
    update public.calendar_event_jobs set payload=null,revision=revision+1,attempts=0,next_attempt_at=now() where room_id=rid;
    delete from public.trip_rooms where id=rid;
  else raise exception 'Unknown action' using errcode='22023';
  end if;
  return '{}'::jsonb;
end $$;
create function public.room_command(p_action text,p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.room_command(p_action,p) $$;
revoke all on function public.room_command(text,jsonb),private.room_command(text,jsonb) from public,anon;
grant execute on function public.room_command(text,jsonb),private.room_command(text,jsonb) to authenticated;

-- Migrate old trips, using only their invited participants (not every group member).
insert into public.trip_rooms(id,organizer_id,title,description,starts_on,ends_on,vote_deadline,timezone,status,selected_date,selected_place_id,plan_version,created_at,updated_at)
select t.id,t.organizer_id,t.title,t.description,
  coalesce((select min(starts_on) from public.date_options where trip_id=t.id),current_date),
  coalesce((select max(ends_on) from public.date_options where trip_id=t.id),current_date+90),t.vote_deadline,t.timezone,
  case when t.status in ('confirmed','completed','cancelled') then t.status else 'planning' end,
  d.starts_on,t.selected_place_option_id,t.plan_version,t.created_at,t.updated_at
from public.trips t left join public.date_options d on d.id=t.selected_date_option_id;
insert into public.room_members(room_id,user_id,joined_at) select trip_id,user_id,joined_at from public.trip_participants where invitation_status<>'declined' on conflict do nothing;
insert into public.room_members(room_id,user_id) select id,organizer_id from public.trip_rooms on conflict do nothing;
insert into public.room_places(id,room_id,name,detail,created_by,created_at) select id,trip_id,name,coalesce(address,''),created_by,created_at from public.place_options;
insert into public.room_votes(room_id,place_id,user_id,created_at) select v.trip_id,v.option_id,v.user_id,v.updated_at from public.place_votes v join public.room_members m on m.room_id=v.trip_id and m.user_id=v.user_id;
insert into public.room_rsvps(room_id,user_id,plan_version,response,updated_at) select r.trip_id,r.user_id,r.plan_version,case when r.response='going' then 'going' else 'not_going' end,r.updated_at from public.trip_rsvps r join public.room_members m on m.room_id=r.trip_id and m.user_id=r.user_id;
insert into public.room_invites(room_id,token_hash,expires_at,revoked_at,created_at) select t.id,i.token_hash,i.expires_at,i.revoked_at,i.created_at from public.invite_links i join public.trips t on t.group_id=i.group_id and (i.trip_id is null or i.trip_id=t.id);
-- Conflicting historical answers choose busy; missing/maybe remain unanswered.
insert into public.profile_availability(user_id,day,answer)
select v.user_id,days.day::date,case when bool_or(v.response='unavailable') then 'busy' else 'free' end
from public.date_votes v join public.date_options d on d.id=v.option_id
cross join lateral generate_series(d.starts_on::timestamp,d.ends_on::timestamp,interval '1 day') days(day)
where v.response in ('available','unavailable') group by v.user_id,days.day::date;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',true,1048576,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_update on storage.objects for update to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_select on storage.objects for select to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
