-- Read-only diagnostic. Returns one JSON result; does not mark notifications read.
with target as (
  select id, username from public.profiles where lower(username)=lower('ugbircan')
)
select jsonb_build_object(
  'user_found', exists(select 1 from target),
  'notification_count', (select count(*) from collection_private.reaction_notifications n join target t on t.id=n.owner_id),
  'unread_count', (select count(*) from collection_private.reaction_notifications n join target t on t.id=n.owner_id where n.read_at is null),
  'recent_notifications', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select n.id,n.kind,n.item_id,n.created_at,n.read_at
    from collection_private.reaction_notifications n join target t on t.id=n.owner_id
    order by n.id desc limit 20
  ) x),'[]'::jsonb),
  'reactions_without_notification', (select count(*) from public.item_reactions r
    join public.items i on i.id=r.item_id join target t on t.id=i.user_id
    where r.voter_id<>i.user_id and not exists(select 1 from collection_private.reaction_notifications n where n.item_id=r.item_id and n.actor_id=r.voter_id and n.kind='reaction')),
  'notification_triggers', (select jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled))
    from pg_trigger where not tgisinternal and tgname ilike '%notif%')
);
