-- Run after 20261018_reaction_notifications.sql and 20261018_profile_privacy.sql.
begin;
alter table collection_private.reaction_notifications add column if not exists kind text not null default 'reaction' check(kind in ('reaction','friend'));
alter table collection_private.reaction_notifications alter column reaction drop not null;
create unique index if not exists friend_notification_pair on collection_private.reaction_notifications(owner_id,actor_id) where kind='friend';

create or replace function collection_private.notify_new_friend()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); recipient uuid;
begin
  if new.status <> 'accepted' then return new; end if;
  if TG_OP='UPDATE' then
    if old.status='accepted' then return new; end if;
  end if;
  if actor is null or actor not in (new.requester_id,new.recipient_id) then return new; end if;
  recipient := case when actor=new.requester_id then new.recipient_id else new.requester_id end;
  if not exists(select 1 from public.profiles where id=recipient and is_public) then return new; end if;
  insert into collection_private.reaction_notifications(owner_id,actor_id,title,category,kind)
  values(recipient,actor,'','','friend') on conflict do nothing;
  return new;
end;
$$;
revoke all on function collection_private.notify_new_friend() from public,anon,authenticated;
drop trigger if exists notify_new_friend on public.friendships;
create trigger notify_new_friend after insert or update on public.friendships
for each row execute function collection_private.notify_new_friend();

create or replace function public.get_reaction_notifications(before_id bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  return jsonb_build_object(
    'unread',(select count(*) from collection_private.reaction_notifications where owner_id=auth.uid() and read_at is null),
    'entries',coalesce((select jsonb_agg(to_jsonb(n) order by n.id desc) from (
      select r.id,r.item_id,r.title,r.category,r.reaction,r.created_at,r.read_at,r.kind,
        case when r.kind='friend' then p.id end as profile_id,
        case when r.kind='friend' then p.username end as username
      from collection_private.reaction_notifications r
      left join public.profiles p on p.id=r.actor_id and r.kind='friend'
      where r.owner_id=auth.uid() and (before_id is null or r.id<before_id)
      order by r.id desc limit 30
    ) n),'[]'::jsonb));
end;
$$;
revoke all on function public.get_reaction_notifications(bigint) from public,anon;
grant execute on function public.get_reaction_notifications(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
