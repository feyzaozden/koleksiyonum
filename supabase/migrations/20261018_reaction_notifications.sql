-- Run after 20261013_item_reactions.sql. Existing records are preserved.
begin;
create schema if not exists collection_private;
revoke all on schema collection_private from public, anon, authenticated;
create table if not exists collection_private.reaction_notifications (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  item_id bigint references public.items(id) on delete set null,
  title text not null,
  category text not null,
  reaction smallint not null check (reaction in (-1,1)),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(item_id, actor_id)
);
alter table collection_private.reaction_notifications enable row level security;
revoke all on collection_private.reaction_notifications from public, anon, authenticated;
create index if not exists reaction_notifications_owner on collection_private.reaction_notifications(owner_id, id desc);

create or replace function collection_private.notify_item_reaction()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into collection_private.reaction_notifications(owner_id,actor_id,item_id,title,category,reaction)
  select user_id,new.voter_id,id,title,category,new.reaction from public.items
  where id=new.item_id and user_id<>new.voter_id
  on conflict(item_id,actor_id) do update set reaction=excluded.reaction;
  -- Switching or removing/re-adding a vote never resets read state or creates another alert.
  return new;
end;
$$;
revoke all on function collection_private.notify_item_reaction() from public,anon,authenticated;
drop trigger if exists notify_item_reaction on public.item_reactions;
create trigger notify_item_reaction after insert or update on public.item_reactions
for each row execute function collection_private.notify_item_reaction();

create or replace function public.get_reaction_notifications(before_id bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  return jsonb_build_object(
    'unread', (select count(*) from collection_private.reaction_notifications where owner_id=auth.uid() and read_at is null),
    'entries', coalesce((select jsonb_agg(to_jsonb(n) order by n.id desc) from (
      select id,item_id,title,category,reaction,created_at,read_at
      from collection_private.reaction_notifications
      where owner_id=auth.uid() and (before_id is null or id<before_id)
      order by id desc limit 30
    ) n),'[]'::jsonb));
end;
$$;
create or replace function public.read_reaction_notification(notification_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  update collection_private.reaction_notifications set read_at=coalesce(read_at,now())
  where id=notification_id and owner_id=auth.uid();
end;
$$;
revoke all on function public.get_reaction_notifications(bigint) from public,anon,authenticated;
revoke all on function public.read_reaction_notification(bigint) from public,anon,authenticated;
grant execute on function public.get_reaction_notifications(bigint) to authenticated;
grant execute on function public.read_reaction_notification(bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
