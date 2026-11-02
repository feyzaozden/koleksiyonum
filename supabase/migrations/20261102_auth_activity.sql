-- Run after 20261102_activity_history.sql.
-- Records new Supabase sessions, not page loads or token refreshes.
begin;
create unique index if not exists activity_auth_session_once
on collection_private.activity_history(record_id) where action='auth_login';

create or replace function collection_private.audit_auth_session()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into collection_private.activity_history(
    occurred_at,actor_id,subject_id,action,record_id,origin,details
  ) values (
    coalesce(new.created_at,clock_timestamp()),new.user_id,new.user_id,
    'auth_login',new.id::text,'supabase_auth',
    jsonb_build_object('event','session_created')
  ) on conflict do nothing;
  return new;
end;
$$;
revoke all on function collection_private.audit_auth_session() from public,anon,authenticated;
drop trigger if exists collection_audit_auth_session on auth.sessions;
create trigger collection_audit_auth_session after insert on auth.sessions
for each row execute function collection_private.audit_auth_session();
commit;
