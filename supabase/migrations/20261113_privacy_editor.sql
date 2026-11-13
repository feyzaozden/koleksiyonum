begin;
-- Requires 20261105_admin_announcements.sql. Keeps the existing text on reruns.
create table if not exists collection_private.site_privacy (id boolean primary key default true check(id), title text not null check(char_length(btrim(title)) between 1 and 200), body text not null check(char_length(btrim(body)) between 1 and 50000), version integer not null default 1, updated_at timestamptz not null default now());
alter table collection_private.site_privacy enable row level security;
revoke all on collection_private.site_privacy from public,anon,authenticated;
insert into collection_private.site_privacy(id,title,body) values(true,'Gizlilik Politikas?','Gizlilik politikamız hazırlanıyor. Bu sayfa henüz tamamlanmış bir KVKK aydınlatma metni değildir.

## Aktivite kayıtları

Yorumlar içerik sahibi ve onun arkadaşları tarafından görülebilir. Anonim yorumlarda yazarın kimliği ve yorum tepkilerinde tepki verenin kimliği diğer üyelere gösterilmez. Yorum yazarı ve içerik sahibi yorumu silebilir. Silinen yorum listeden kaldırılır; altındaki cevaplar korunur.

Giriş ve uygulama içi işlem bilgileri, hizmet güvenliğinin sağlanması ve teknik sorunların giderilmesi amacıyla işlenir.

Aktivite kayıtları diğer üyelerle paylaşılmaz. Aktivite geçmişi için saklama süresi 90 gündür; süresi dolan kayıtlar günlük temizlikte, zamanlanmış temizlik kurulmamışsa sonraki kayıt sırasında temizlenir. Kimlik doğrulama günlükleri Supabase tarafından ayrıca tutulur.

Hesabın ve kişisel verilerinle ilgili soruların için bize ulaşabilirsin:

koleksiyonum.destek@gmail.com') on conflict(id) do nothing;

create or replace function public.get_privacy_policy()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('title',title,'body',body,'version',version,'updated_at',updated_at) from collection_private.site_privacy where id=true;
$$;
create or replace function public.save_privacy_policy(heading text, content text, expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform 1 from collection_private.app_admins where user_id=auth.uid() for share;
  if not found then raise exception 'Admin permission required'; end if;
  if heading is null or content is null or char_length(btrim(heading)) not between 1 and 200 or char_length(btrim(content)) not between 1 and 50000 then raise exception 'Invalid policy text'; end if;
  update collection_private.site_privacy set title=btrim(heading),body=btrim(content),version=version+1,updated_at=clock_timestamp() where id=true and version=expected_version;
  if not found then raise exception 'Policy changed; reload before saving'; end if;
  return public.get_privacy_policy();
end;
$$;
revoke all on function public.get_privacy_policy(),public.save_privacy_policy(text,text,integer) from public,anon,authenticated;
grant execute on function public.get_privacy_policy() to anon,authenticated;
grant execute on function public.save_privacy_policy(text,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
