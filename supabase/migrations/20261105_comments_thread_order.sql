-- Run after 20261105_comments.sql. Page by threads, keep replies with their parent.
begin;
create or replace function public.get_item_comments(target_item_id bigint, after_id bigint default 0, focus_id bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; cursor_id bigint:=coalesce(after_id,0); result jsonb; item_title text; focus_root bigint; thread_ids bigint[]; next_cursor bigint;
begin
  owner_id:=collection_private.lock_comment_access(target_item_id);
  select title into item_title from public.items where id=target_item_id;
  if focus_id is not null then
    if not exists(select 1 from collection_private.item_comments where id=focus_id and item_id=target_item_id) then
      raise exception 'Bu yorum artık mevcut değil.';
    end if;
    select coalesce(parent_id,id) into focus_root from collection_private.item_comments where id=focus_id and item_id=target_item_id;
    select coalesce(max(root),0) into cursor_id from (
      select distinct coalesce(parent_id,id) as root from collection_private.item_comments
      where item_id=target_item_id and deleted_at is null and author_id is not null
      and coalesce(parent_id,id)<focus_root
    ) previous_roots;
  end if;
  select array_agg(root order by root) into thread_ids from (
    select distinct coalesce(parent_id,id) as root from collection_private.item_comments
    where item_id=target_item_id and deleted_at is null and author_id is not null
      and coalesce(parent_id,id)>cursor_id
    order by root limit 50
  ) roots;
  select coalesce(max(root),cursor_id) into next_cursor from unnest(thread_ids) root;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.thread_id,row.id),'[]'::jsonb) into result from (
    select c.id,c.parent_id,coalesce(c.parent_id,c.id) as thread_id,
      case when c.deleted_at is null and c.author_id is not null then c.body end as body,
      (c.deleted_at is not null or c.author_id is null) as deleted,
      c.anonymous,c.created_at,
      case when not c.anonymous and c.deleted_at is null then p.id end as profile_id,
      case when not c.anonymous and c.deleted_at is null then p.username end as username,
      case when not c.anonymous and c.deleted_at is null then p.avatar_emoji end as avatar_emoji,
      case when not c.anonymous and c.deleted_at is null then p.avatar_path end as avatar_path,
      (c.author_id=auth.uid()) as own,
      (c.deleted_at is null and c.author_id is not null and (c.author_id=auth.uid() or owner_id=auth.uid())) as can_delete,
      case when parent.deleted_at is null and parent.author_id is not null then left(parent.body,100) end as parent_preview,
      (select count(*) from collection_private.comment_reactions r where r.comment_id=c.id and r.reaction=1 and c.deleted_at is null) as likes,
      (select count(*) from collection_private.comment_reactions r where r.comment_id=c.id and r.reaction=-1 and c.deleted_at is null) as dislikes,
      (select reaction from collection_private.comment_reactions r where r.comment_id=c.id and r.voter_id=auth.uid() and c.deleted_at is null) as my_reaction
    from collection_private.item_comments c
    left join public.profiles p on p.id=c.author_id
    left join collection_private.item_comments parent on parent.id=c.parent_id
    where c.item_id=target_item_id and c.deleted_at is null and c.author_id is not null and coalesce(c.parent_id,c.id)=any(thread_ids) order by coalesce(c.parent_id,c.id),c.id
  ) row;
  return jsonb_build_object('title',item_title,'entries',result,'next_after',next_cursor,'has_more',exists(
    select 1 from collection_private.item_comments where item_id=target_item_id and deleted_at is null and author_id is not null and coalesce(parent_id,id)>next_cursor
  ));
end;
$$;

notify pgrst,'reload schema';
commit;
