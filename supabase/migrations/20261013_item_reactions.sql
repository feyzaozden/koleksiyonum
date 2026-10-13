-- Existing collections, profiles and friendships are preserved.
-- Run after 20260925_friendships.sql. Votes are NOT readable via the table API.
begin;

create table if not exists public.item_reactions (
  item_id bigint not null references public.items(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  reaction smallint not null check (reaction in (-1, 1)),
  primary key (item_id, voter_id)
);
alter table public.item_reactions enable row level security;
revoke all on public.item_reactions from public, anon, authenticated;

create or replace function public.get_item_reactions(item_ids bigint[])
returns table(item_id bigint, likes bigint, dislikes bigint, my_reaction smallint)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  if coalesce(cardinality(item_ids), 0) > 500 then
    raise exception 'Bir seferde en fazla 500 içerik sorgulanabilir.';
  end if;
  return query
    select i.id,
      count(r.voter_id) filter (where r.reaction = 1),
      count(r.voter_id) filter (where r.reaction = -1),
      max(r.reaction) filter (where r.voter_id = auth.uid())
    from public.items i
    left join public.item_reactions r on r.item_id = i.id
    where i.id = any(item_ids) and (
      i.user_id = auth.uid() or exists (
        select 1 from public.friendships f where f.status = 'accepted' and
          ((f.requester_id = auth.uid() and f.recipient_id = i.user_id)
           or (f.recipient_id = auth.uid() and f.requester_id = i.user_id))
      )
    )
    group by i.id;
end;
$$;

create or replace function public.set_item_reaction(target_item_id bigint, reaction_value integer)
returns table(item_id bigint, likes bigint, dislikes bigint, my_reaction smallint)
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  item_owner uuid;
begin
  if actor is null then raise exception 'Lütfen giriş yap.'; end if;
  if reaction_value is not null and reaction_value not in (-1, 1) then
    raise exception 'Geçersiz oy.';
  end if;
  -- Serializes writes for this item and prevents deletion during the operation.
  select i.user_id into item_owner from public.items i where i.id = target_item_id for update;
  if not found then raise exception 'İçeriğe erişilemiyor.'; end if;
  if item_owner = actor then raise exception 'Kendi içeriğine oy veremezsin.'; end if;
  -- Hold friendship until commit, so concurrent removal cannot grant stale access.
  perform 1 from public.friendships f where f.status = 'accepted' and
    ((f.requester_id = actor and f.recipient_id = item_owner)
     or (f.recipient_id = actor and f.requester_id = item_owner)) for share;
  if not found then raise exception 'İçeriğe erişilemiyor.'; end if;

  if reaction_value is null then
    delete from public.item_reactions r where r.item_id = target_item_id and r.voter_id = actor;
  else
    insert into public.item_reactions as r (item_id, voter_id, reaction)
      values (target_item_id, actor, reaction_value::smallint)
      on conflict on constraint item_reactions_pkey do update set reaction = excluded.reaction;
  end if;
  return query select * from public.get_item_reactions(array[target_item_id]);
end;
$$;

revoke all on function public.get_item_reactions(bigint[]) from public, anon, authenticated;
revoke all on function public.set_item_reaction(bigint, integer) from public, anon, authenticated;
grant execute on function public.get_item_reactions(bigint[]) to authenticated;
grant execute on function public.set_item_reaction(bigint, integer) to authenticated;
commit;
