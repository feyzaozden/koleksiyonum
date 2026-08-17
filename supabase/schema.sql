-- Koleksiyonum — Supabase şeması (açık kayıt / çoklu kullanıcı modeli)
-- Bu dosyayı Supabase Dashboard > SQL Editor içinde çalıştırın.
--
-- NOT: Eski (auth'suz) sürümde items.user_id sabit bir integer'dı (0 veya 1).
-- Bu sürümde her kullanıcı gerçek bir Supabase Auth hesabına sahip olduğundan
-- user_id artık auth.users.id (uuid) değerine referans veriyor. Eski items
-- tablonuzda veri varsa, aşağıdaki adımları izleyin:
--   1. Bu dosyayı yeni bir proje/şemada ya da eski tabloyu yeniden adlandırıp çalıştırın.
--   2. Feyza ve Ümmü Gülsüm (veya diğer kullanıcılar) /signup sayfasından hesap açsın.
--   3. Eski items satırlarını "select id from auth.users where email=...' ile bulduğunuz
--      uuid'leri kullanarak yeni tabloya INSERT edin (user_id eşlemesi: eski 0 -> ilk kullanıcı, 1 -> ikinci kullanıcı).

-- ── PROFILES ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_emoji text not null default '📖',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Yeni bir auth.users satırı oluşunca otomatik profil satırı aç
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_emoji)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_emoji', '📖')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── ITEMS ─────────────────────────────────────────────────
create table if not exists public.items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('kitap','film','dizi')),
  title text not null,
  creator text,
  year text,
  status text not null default 'bekliyor' check (status in ('bekliyor','devam','bitti')),
  note text,
  start_date date,
  end_date date,
  rating smallint check (rating between 1 and 10),
  emoji text,
  added_at timestamptz not null default now()
);

create index if not exists items_user_id_idx on public.items(user_id);
create index if not exists items_category_idx on public.items(category);

alter table public.items enable row level security;

-- Herkes (giriş yapmış her kullanıcı) tüm koleksiyonları görebilir
-- (IMDb ekranı ve "başka kullanıcının koleksiyonuna bak" özelliği için gerekli)
drop policy if exists "items_select_authenticated" on public.items;
create policy "items_select_authenticated"
  on public.items for select
  to authenticated
  using (true);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own"
  on public.items for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own"
  on public.items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own"
  on public.items for delete
  to authenticated
  using (auth.uid() = user_id);
