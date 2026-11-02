-- Run after 20261102_activity_history.sql. Browser-reported visits, not logins.
begin;
create unique index if not exists activity_document_once
on collection_private.activity_history(actor_id,record_id)
where action in ('site_opened','page_reloaded');
create or replace function public.record_site_open(document_id uuid, navigation_kind text default 'navigate')
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Lütfen giriş yap.'; end if;
  if document_id is null or navigation_kind is null or navigation_kind not in ('navigate','reload','back_forward') then
    raise exception 'Geçersiz ziyaret bilgisi.';
  end if;
  insert into collection_private.activity_history(actor_id,subject_id,action,record_id,origin,details)
  values(actor,actor,case when navigation_kind='reload' then 'page_reloaded' else 'site_opened' end,
    document_id::text,'client_reported',jsonb_build_object('navigation_kind',navigation_kind))
  on conflict do nothing;
end;
$$;
revoke all on function public.record_site_open(uuid,text) from public,anon,authenticated;
grant execute on function public.record_site_open(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
