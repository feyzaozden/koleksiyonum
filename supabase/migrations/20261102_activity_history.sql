-- Requires profiles/usernames, friendships, progress, reactions and profile privacy.
-- No historical actions are inferred or backfilled. Existing application data is preserved.
begin;
create schema if not exists collection_private;
revoke all on schema collection_private from public,anon,authenticated;

create table if not exists collection_private.activity_history (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  subject_id uuid,
  related_user_id uuid,
  action text not null,
  record_id text,
  origin text not null,
  details jsonb not null default '{}'
);
create index if not exists activity_actor_time on collection_private.activity_history(actor_id,occurred_at desc);
create index if not exists activity_subject_time on collection_private.activity_history(subject_id,occurred_at desc);
create index if not exists activity_time on collection_private.activity_history(occurred_at);
create table if not exists collection_private.activity_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null,
  last_logged_at timestamptz not null
);
create table if not exists collection_private.activity_maintenance (
  id boolean primary key default true check(id), last_run date not null
);
alter table collection_private.activity_history enable row level security;
alter table collection_private.activity_presence enable row level security;
alter table collection_private.activity_maintenance enable row level security;
revoke all on collection_private.activity_history,collection_private.activity_presence,collection_private.activity_maintenance from public,anon,authenticated;

create or replace function collection_private.prune_activity_history()
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from collection_private.activity_history where occurred_at < clock_timestamp()-interval '90 days';
  delete from collection_private.activity_presence where last_seen_at < clock_timestamp()-interval '90 days';
end;
$$;
revoke all on function collection_private.prune_activity_history() from public,anon,authenticated;

create or replace function collection_private.activity_daily_cleanup()
returns trigger language plpgsql security definer set search_path='' as $$
declare claimed boolean;
begin
  if exists(select 1 from collection_private.activity_maintenance where last_run=current_date) then return new; end if;
  if not pg_try_advisory_xact_lock(71102026) then return new; end if;
  insert into collection_private.activity_maintenance as m(id,last_run) values(true,current_date)
  on conflict(id) do update set last_run=excluded.last_run where m.last_run<excluded.last_run
  returning true into claimed;
  if claimed then perform collection_private.prune_activity_history(); end if;
  return new;
end;
$$;
revoke all on function collection_private.activity_daily_cleanup() from public,anon,authenticated;
drop trigger if exists activity_daily_cleanup on collection_private.activity_history;
create trigger activity_daily_cleanup after insert on collection_private.activity_history
for each statement execute function collection_private.activity_daily_cleanup();

create or replace function collection_private.audit_application_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  before_row jsonb := case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  after_row jsonb := case when TG_OP='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  row_data jsonb;
  actor uuid := auth.uid(); subject uuid; related uuid;
  event_name text; entity text; info jsonb := '{}'; changed text[];
  old_values jsonb := '{}'; new_values jsonb := '{}'; field text;
  source text := case when auth.uid() is null then 'server_or_admin' else 'authenticated' end;
begin
  row_data := case when TG_OP='DELETE' then before_row else after_row end;
  if TG_OP='UPDATE' and before_row=after_row then return new; end if;
  if pg_trigger_depth()>1 then source := 'cascade_or_trigger'; end if;
  select array_agg(k order by k) into changed from jsonb_object_keys(before_row || after_row) k
    where before_row->k is distinct from after_row->k;
  if TG_TABLE_NAME='items' then
    subject := (row_data->>'user_id')::uuid; entity := row_data->>'id';
    event_name := case TG_OP when 'INSERT' then 'item_created' when 'DELETE' then 'item_deleted' else 'item_updated' end;
    if TG_OP='UPDATE' and 'progress'=any(changed) then event_name := 'item_progress_updated'; end if;
    -- Never copy free-text notes or entire row payloads into history.
    foreach field in array array['title','category','creator','year','status','rating','start_date','end_date','progress'] loop
      if field=any(changed) then
        old_values := old_values || jsonb_build_object(field,before_row->field);
        new_values := new_values || jsonb_build_object(field,after_row->field);
      end if;
    end loop;
    info := jsonb_build_object('title',row_data->>'title','changed_fields',changed,'before',old_values,'after',new_values);
  elsif TG_TABLE_NAME='profiles' then
    subject := (row_data->>'id')::uuid; entity := row_data->>'id';
    event_name := case TG_OP when 'INSERT' then 'profile_created' when 'DELETE' then 'profile_deleted' else 'profile_updated' end;
    foreach field in array array['username','is_public'] loop
      if field=any(changed) then
        old_values := old_values || jsonb_build_object(field,before_row->field);
        new_values := new_values || jsonb_build_object(field,after_row->field);
      end if;
    end loop;
    info := jsonb_build_object('changed_fields',changed,'before',old_values,'after',new_values);
  elsif TG_TABLE_NAME='item_reactions' then
    subject := (row_data->>'voter_id')::uuid; entity := row_data->>'item_id';
    select i.user_id,jsonb_build_object('title',i.title) into related,info from public.items i where i.id=entity::bigint;
    event_name := case TG_OP when 'INSERT' then 'reaction_added' when 'DELETE' then 'reaction_removed' else 'reaction_changed' end;
    info := coalesce(info,'{}'::jsonb) || jsonb_build_object('before',before_row->'reaction','after',after_row->'reaction');
  elsif TG_TABLE_NAME='friendships' then
    subject := (row_data->>'requester_id')::uuid; related := (row_data->>'recipient_id')::uuid; entity := row_data->>'id';
    event_name := case
      when TG_OP='INSERT' and row_data->>'status'='accepted' then 'friendship_auto_accepted'
      when TG_OP='INSERT' then 'friend_request_sent'
      when TG_OP='UPDATE' and after_row->>'status'='accepted' then 'friendship_accepted'
      when TG_OP='DELETE' and before_row->>'status'='accepted' then 'friendship_removed'
      when TG_OP='DELETE' and actor=subject then 'friend_request_cancelled'
      when TG_OP='DELETE' and actor=related then 'friend_request_rejected'
      else 'friendship_changed' end;
    info := jsonb_build_object('before',before_row->'status','after',after_row->'status');
  else
    raise exception 'Unsupported activity table';
  end if;
  insert into collection_private.activity_history(actor_id,subject_id,related_user_id,action,record_id,origin,details)
  values(actor,subject,related,event_name,entity,source,info);
  if TG_OP='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function collection_private.audit_application_change() from public,anon,authenticated;
drop trigger if exists audit_activity on public.items;
create trigger audit_activity after insert or update or delete on public.items for each row execute function collection_private.audit_application_change();
drop trigger if exists audit_activity on public.profiles;
create trigger audit_activity after insert or update or delete on public.profiles for each row execute function collection_private.audit_application_change();
drop trigger if exists audit_activity on public.item_reactions;
create trigger audit_activity after insert or update or delete on public.item_reactions for each row execute function collection_private.audit_application_change();
drop trigger if exists audit_activity on public.friendships;
create trigger audit_activity after insert or update or delete on public.friendships for each row execute function collection_private.audit_application_change();

-- Client-reported presence is approximate, not proof of human activity.
-- No client-supplied identity, timestamp, URL, input contents or IP is accepted.
create or replace function public.record_activity_presence()
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); previous collection_private.activity_presence%rowtype;
  stamp timestamptz := clock_timestamp(); event_name text;
begin
  if actor is null then raise exception 'Lütfen giriş yap.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,71102));
  select * into previous from collection_private.activity_presence where user_id=actor for update;
  if previous.last_seen_at > stamp-interval '60 seconds' then return; end if;
  if previous.user_id is null or previous.last_seen_at <= stamp-interval '30 minutes' then
    event_name := 'site_visit';
  elsif previous.last_logged_at <= stamp-interval '5 minutes' then
    event_name := 'site_active';
  end if;
  insert into collection_private.activity_presence(user_id,last_seen_at,last_logged_at)
  values(actor,stamp,case when event_name is not null then stamp else previous.last_logged_at end)
  on conflict(user_id) do update set last_seen_at=excluded.last_seen_at,last_logged_at=excluded.last_logged_at;
  if event_name is not null then
    insert into collection_private.activity_history(actor_id,subject_id,action,origin)
    values(actor,actor,event_name,'client_reported');
  end if;
end;
$$;
revoke all on function public.record_activity_presence() from public,anon,authenticated;
grant execute on function public.record_activity_presence() to authenticated;
notify pgrst,'reload schema';
commit;
