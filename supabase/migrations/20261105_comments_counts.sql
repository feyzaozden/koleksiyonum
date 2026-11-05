-- Run after 20261105_comments.sql. Read-only counts; preserves comments.
begin;
create or replace function public.get_item_comment_counts(item_ids bigint[])
returns table(item_id bigint, comment_count bigint)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  if coalesce(cardinality(item_ids),0)>500 then raise exception 'Bir seferde en fazla 500 içerik sorgulanabilir.'; end if;
  return query select i.id,count(c.id)
  from public.items i
  left join collection_private.item_comments c on c.item_id=i.id and c.deleted_at is null and c.author_id is not null
  where i.id=any(item_ids) and collection_private.can_comment(i.user_id)
  group by i.id;
end;
$$;
revoke all on function public.get_item_comment_counts(bigint[]) from public,anon,authenticated;
grant execute on function public.get_item_comment_counts(bigint[]) to authenticated;
notify pgrst,'reload schema';
commit;
