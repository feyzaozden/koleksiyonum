-- Run after friendships and item_reactions migrations. Existing accounts remain private.
begin;
alter table public.profiles add column if not exists is_public boolean not null default false;
grant update(is_public) on public.profiles to authenticated;

create or replace function public.send_friend_request(target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); open_account boolean;
begin
  if actor is null or actor = target_id then raise exception 'Geçersiz arkadaşlık isteği.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(actor,target_id)::text || greatest(actor,target_id)::text, 418));
  select is_public into open_account from public.profiles where id=target_id for share;
  if not found then raise exception 'Profil bulunamadı.'; end if;
  insert into public.friendships(requester_id,recipient_id,status)
  values(actor,target_id,case when open_account then 'accepted' else 'pending' end)
  on conflict do nothing;
  if open_account then
    update public.friendships set status='accepted'
    where status='pending' and ((requester_id=actor and recipient_id=target_id) or (requester_id=target_id and recipient_id=actor));
  end if;
end;
$$;
revoke all on function public.send_friend_request(uuid) from public,anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

drop policy if exists items_friends_only on public.items;
create policy items_friends_only on public.items as restrictive for select to public using (
  auth.uid() is not null and (
    auth.uid()=user_id
    or exists(select 1 from public.profiles p where p.id=items.user_id and p.is_public)
    or exists(select 1 from public.friendships f where f.status='accepted' and
      ((f.requester_id=auth.uid() and f.recipient_id=items.user_id) or (f.recipient_id=auth.uid() and f.requester_id=items.user_id)))
  )
);

-- Public profile visitors may read anonymous totals; voting still requires friendship.
create or replace function public.get_item_reactions(item_ids bigint[])
returns table(item_id bigint, likes bigint, dislikes bigint, my_reaction smallint)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  if coalesce(cardinality(item_ids),0)>500 then raise exception 'Bir seferde en fazla 500 içerik sorgulanabilir.'; end if;
  return query select i.id,
    count(r.voter_id) filter(where r.reaction=1), count(r.voter_id) filter(where r.reaction=-1),
    max(r.reaction) filter(where r.voter_id=auth.uid())
  from public.items i left join public.item_reactions r on r.item_id=i.id
  where i.id=any(item_ids) and (
    i.user_id=auth.uid()
    or exists(select 1 from public.profiles p where p.id=i.user_id and p.is_public)
    or exists(select 1 from public.friendships f where f.status='accepted' and
      ((f.requester_id=auth.uid() and f.recipient_id=i.user_id) or (f.recipient_id=auth.uid() and f.requester_id=i.user_id)))
  ) group by i.id;
end;
$$;
revoke all on function public.get_item_reactions(bigint[]) from public,anon;
grant execute on function public.get_item_reactions(bigint[]) to authenticated;
notify pgrst, 'reload schema';
commit;
