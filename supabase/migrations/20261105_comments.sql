-- Requires friendships, profile usernames/photos, reactions and friend notifications.
begin;
create table if not exists collection_private.item_comments (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.items(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  parent_id bigint references collection_private.item_comments(id) on delete cascade,
  body text,
  anonymous boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create index if not exists comments_item_id on collection_private.item_comments(item_id,id);
create index if not exists comments_author_id on collection_private.item_comments(author_id,id desc);
create table if not exists collection_private.comment_reactions (
  comment_id bigint not null references collection_private.item_comments(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  reaction smallint not null check(reaction in (-1,1)),
  primary key(comment_id,voter_id)
);
alter table collection_private.item_comments enable row level security;
alter table collection_private.comment_reactions enable row level security;
revoke all on collection_private.item_comments,collection_private.comment_reactions from public,anon,authenticated;

create or replace function collection_private.can_comment(owner_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (auth.uid()=owner_id or exists(
    select 1 from public.friendships f where f.status='accepted' and
    ((f.requester_id=auth.uid() and f.recipient_id=owner_id) or (f.recipient_id=auth.uid() and f.requester_id=owner_id))
  ));
$$;
-- Locks use the same item -> friendship order as reaction writes.
create or replace function collection_private.lock_comment_access(target_item_id bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  select user_id into owner_id from public.items where id=target_item_id for share;
  if not found then raise exception 'İçerik artık mevcut değil.'; end if;
  if owner_id<>auth.uid() then
    perform 1 from public.friendships f where f.status='accepted' and
      ((f.requester_id=auth.uid() and f.recipient_id=owner_id) or (f.recipient_id=auth.uid() and f.requester_id=owner_id)) for share;
    if not found then raise exception 'Yorumlar yalnızca içerik sahibi ve arkadaşlarına açıktır.'; end if;
  end if;
  return owner_id;
end;
$$;

alter table collection_private.reaction_notifications drop constraint if exists reaction_notifications_kind_check;
alter table collection_private.reaction_notifications add constraint reaction_notifications_kind_check check(kind in ('reaction','friend','comment','reply'));
alter table collection_private.reaction_notifications add column if not exists comment_id bigint references collection_private.item_comments(id) on delete set null;
alter table collection_private.reaction_notifications add column if not exists comment_item_id bigint references public.items(id) on delete set null;

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

create or replace function public.get_item_comments(target_item_id bigint, after_id bigint default 0, focus_id bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; cursor_id bigint:=coalesce(after_id,0); result jsonb; item_title text;
begin
  owner_id:=collection_private.lock_comment_access(target_item_id);
  select title into item_title from public.items where id=target_item_id;
  if focus_id is not null then
    if not exists(select 1 from collection_private.item_comments where id=focus_id and item_id=target_item_id) then
      raise exception 'Bu yorum artık mevcut değil.';
    end if;
    select coalesce((select id from collection_private.item_comments where item_id=target_item_id and deleted_at is null and author_id is not null and id<focus_id order by id desc offset 10 limit 1),0) into cursor_id;
  end if;
  select coalesce(jsonb_agg(to_jsonb(row) order by row.id),'[]'::jsonb) into result from (
    select c.id,c.parent_id,
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
    where c.item_id=target_item_id and c.deleted_at is null and c.author_id is not null and c.id>cursor_id order by c.id limit 50
  ) row;
  return jsonb_build_object('title',item_title,'entries',result,'has_more',exists(
    select 1 from collection_private.item_comments where item_id=target_item_id and deleted_at is null and author_id is not null and id>coalesce((result->-1->>'id')::bigint,cursor_id)
  ));
end;
$$;

create or replace function public.delete_item_comment(target_comment_id bigint)
returns void language plpgsql security definer set search_path='' as $$
declare entry collection_private.item_comments%rowtype; owner_id uuid; item bigint;
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  select item_id into item from collection_private.item_comments where id=target_comment_id;
  select user_id into owner_id from public.items where id=item for share;
  select * into entry from collection_private.item_comments where id=target_comment_id for update;
  if not found or (entry.author_id is distinct from auth.uid() and owner_id is distinct from auth.uid()) then raise exception 'Bu yorumu silme yetkin yok.'; end if;
  update collection_private.item_comments set body=null,deleted_at=clock_timestamp() where id=target_comment_id and deleted_at is null;
  delete from collection_private.comment_reactions where comment_id=target_comment_id;
end;
$$;

create or replace function public.set_comment_reaction(target_comment_id bigint, reaction_value integer)
returns void language plpgsql security definer set search_path='' as $$
declare entry collection_private.item_comments%rowtype; item bigint;
begin
  if reaction_value is not null and reaction_value not in (-1,1) then raise exception 'Geçersiz tepki.'; end if;
  select item_id into item from collection_private.item_comments where id=target_comment_id;
  perform collection_private.lock_comment_access(item);
  select * into entry from collection_private.item_comments where id=target_comment_id for update;
  if not found or entry.deleted_at is not null or entry.author_id is null then raise exception 'Bu yorum artık mevcut değil.'; end if;
  if entry.author_id=auth.uid() then raise exception 'Kendi yorumuna tepki veremezsin.'; end if;
  if reaction_value is null then delete from collection_private.comment_reactions where comment_id=target_comment_id and voter_id=auth.uid();
  else insert into collection_private.comment_reactions values(target_comment_id,auth.uid(),reaction_value)
    on conflict(comment_id,voter_id) do update set reaction=excluded.reaction;
  end if;
end;
$$;

create or replace function public.get_my_comments(before_id bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(row) order by row.id desc) from (
    select c.id,c.item_id,c.body,c.anonymous,c.created_at,i.title,collection_private.can_comment(i.user_id) as can_open
    from collection_private.item_comments c join public.items i on i.id=c.item_id
    where c.author_id=auth.uid() and c.deleted_at is null and (before_id is null or c.id<before_id)
    order by c.id desc limit 50
  ) row),'[]'::jsonb);
end;
$$;

create or replace function public.get_reaction_notifications(before_id bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Lütfen giriş yap.'; end if;
  return jsonb_build_object(
    'unread',(select count(*) from collection_private.reaction_notifications where owner_id=auth.uid() and read_at is null),
    'entries',coalesce((select jsonb_agg(to_jsonb(n) order by n.id desc) from (
      select r.id,coalesce(r.item_id,r.comment_item_id) as item_id,r.title,r.category,r.reaction,r.created_at,r.read_at,r.kind,r.comment_id,
        case when r.kind='friend' or (r.kind in ('comment','reply') and not c.anonymous and c.deleted_at is null) then p.id end as profile_id,
        case when r.kind='friend' or (r.kind in ('comment','reply') and not c.anonymous and c.deleted_at is null) then p.username end as username
      from collection_private.reaction_notifications r
      left join collection_private.item_comments c on c.id=r.comment_id
      left join public.profiles p on p.id=r.actor_id
      where r.owner_id=auth.uid() and (before_id is null or r.id<before_id)
      order by r.id desc limit 30
    ) n),'[]'::jsonb));
end;
$$;

revoke all on function collection_private.can_comment(uuid),collection_private.lock_comment_access(bigint) from public,anon,authenticated;

-- Integrate with the optional administrator history without copying comment text.
create or replace function collection_private.audit_comment_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare data jsonb; previous jsonb; related uuid; subject uuid; entity text; event_name text;
begin
  if to_regclass('collection_private.activity_history') is null then return null; end if;
  if TG_OP='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new; end if;
  data:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous:=case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  if TG_TABLE_NAME='item_comments' then
    subject:=(data->>'author_id')::uuid; entity:=data->>'id';
    select user_id into related from public.items where id=(data->>'item_id')::bigint;
    event_name:=case when TG_OP='INSERT' then 'comment_created' when TG_OP='DELETE' or data->>'deleted_at' is not null then 'comment_deleted' else 'comment_changed' end;
    data:=jsonb_build_object('item_id',data->'item_id','parent_id',data->'parent_id','anonymous',data->'anonymous');
  else
    subject:=(data->>'voter_id')::uuid; entity:=data->>'comment_id';
    select c.author_id into related from collection_private.item_comments c where id=entity::bigint;
    event_name:=case TG_OP when 'INSERT' then 'comment_reaction_added' when 'DELETE' then 'comment_reaction_removed' else 'comment_reaction_changed' end;
    data:=jsonb_build_object('before',previous->'reaction','after',case when TG_OP='DELETE' then null else data->'reaction' end);
  end if;
  insert into collection_private.activity_history(actor_id,subject_id,related_user_id,action,record_id,origin,details)
  values(auth.uid(),subject,related,event_name,entity,case when pg_trigger_depth()>1 then 'cascade_or_trigger' when auth.uid() is null then 'server_or_admin' else 'authenticated' end,data);
  return null;
end;
$$;
revoke all on function collection_private.audit_comment_change() from public,anon,authenticated;
drop trigger if exists audit_comment_change on collection_private.item_comments;
create trigger audit_comment_change after insert or update or delete on collection_private.item_comments for each row execute function collection_private.audit_comment_change();
drop trigger if exists audit_comment_change on collection_private.comment_reactions;
create trigger audit_comment_change after insert or update or delete on collection_private.comment_reactions for each row execute function collection_private.audit_comment_change();

revoke all on function public.add_item_comment(bigint,text,boolean,bigint),public.get_item_comments(bigint,bigint,bigint),public.delete_item_comment(bigint),public.set_comment_reaction(bigint,integer),public.get_my_comments(bigint),public.get_reaction_notifications(bigint) from public,anon,authenticated;
grant execute on function public.add_item_comment(bigint,text,boolean,bigint),public.get_item_comments(bigint,bigint,bigint),public.delete_item_comment(bigint),public.set_comment_reaction(bigint,integer),public.get_my_comments(bigint),public.get_reaction_notifications(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
