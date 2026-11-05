-- Run after 20261105_comments.sql. Removes length limits; preserves existing comments.
begin;
create or replace function public.add_item_comment(target_item_id bigint, content text, as_anonymous boolean default false, reply_to bigint default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare owner_id uuid; parent collection_private.item_comments%rowtype; new_id bigint; clean text;
begin
  owner_id:=collection_private.lock_comment_access(target_item_id);
  clean:=regexp_replace(translate(coalesce(content,''),chr(160)||chr(65279)||chr(8239),'   '),'^[[:space:]]+|[[:space:]]+$','','g');
  if clean='' then raise exception 'Yorumunu yaz.'; end if;
  if reply_to is not null then
    select * into parent from collection_private.item_comments where id=reply_to and item_id=target_item_id for share;
    if not found or parent.deleted_at is not null or parent.parent_id is not null then raise exception 'Yalnızca mevcut bir ana yoruma cevap verebilirsin.'; end if;
  end if;
  insert into collection_private.item_comments(item_id,author_id,parent_id,body,anonymous)
  values(target_item_id,auth.uid(),reply_to,clean,coalesce(as_anonymous,false)) returning id into new_id;
  -- item_id stays NULL here so the old reaction (item,actor) uniqueness is unaffected.
  if owner_id<>auth.uid() then
    insert into collection_private.reaction_notifications(owner_id,actor_id,title,category,kind,comment_id,comment_item_id)
    select owner_id,auth.uid(),i.title,i.category,'comment',new_id,i.id from public.items i where i.id=target_item_id;
  end if;
  if reply_to is not null and parent.author_id is not null and parent.author_id<>auth.uid() and parent.author_id<>owner_id
    and collection_private.can_comment(owner_id) then
    -- Reply recipient must still be a friend of the item owner.
    if exists(select 1 from public.friendships f where f.status='accepted' and
      ((f.requester_id=parent.author_id and f.recipient_id=owner_id) or (f.recipient_id=parent.author_id and f.requester_id=owner_id))) then
      insert into collection_private.reaction_notifications(owner_id,actor_id,title,category,kind,comment_id,comment_item_id)
      select parent.author_id,auth.uid(),i.title,i.category,'reply',new_id,i.id from public.items i where i.id=target_item_id;
    end if;
  end if;
  return new_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
