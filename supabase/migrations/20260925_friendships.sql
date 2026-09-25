-- Run once in Supabase SQL Editor before deploying the new frontend.
-- Existing profiles and items are preserved. Existing users start without friends.
begin;

alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (char_length(bio) <= 160);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);
create unique index if not exists friendships_pair_idx on public.friendships
  (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index if not exists friendships_recipient_idx on public.friendships(recipient_id);
create index if not exists friendships_requester_idx on public.friendships(requester_id);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;
drop policy if exists friendships_participants on public.friendships;
create policy friendships_participants on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, recipient_id));

-- All writes go through these functions; clients cannot forge accepted requests.
create or replace function public.send_friend_request(target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() = target_id then
    raise exception 'Geçersiz arkadaşlık isteği.';
  end if;
  insert into public.friendships(requester_id, recipient_id)
    values (auth.uid(), target_id) on conflict do nothing;
end;
$$;

create or replace function public.accept_friend_request(request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.friendships set status = 'accepted'
    where id = request_id and recipient_id = auth.uid() and status = 'pending';
  if not found then raise exception 'İstek artık mevcut değil veya onaylama yetkin yok.'; end if;
end;
$$;

-- Recipient can reject, sender can cancel, either friend can unfriend.
create or replace function public.remove_friendship(request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships where id = request_id
    and auth.uid() in (requester_id, recipient_id);
  if not found then raise exception 'Arkadaşlık veya istek artık mevcut değil.'; end if;
end;
$$;

revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.accept_friend_request(uuid) from public, anon;
revoke all on function public.remove_friendship(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;

-- Restrictive policy also protects against an older permissive SELECT policy.
drop policy if exists items_select_authenticated on public.items;
create policy items_select_authenticated on public.items for select to authenticated using (true);
drop policy if exists items_friends_only on public.items;
create policy items_friends_only on public.items as restrictive for select to public using (
  auth.uid() = user_id or exists (
    select 1 from public.friendships f where f.status = 'accepted' and
      ((f.requester_id = auth.uid() and f.recipient_id = items.user_id)
       or (f.recipient_id = auth.uid() and f.requester_id = items.user_id))
  )
);
commit;
