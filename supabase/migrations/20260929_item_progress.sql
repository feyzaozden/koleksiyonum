-- Only adds progress metadata. Existing collection records and RLS remain intact.
begin;
alter table public.items add column if not exists progress jsonb not null default '{}';
create or replace function public.valid_item_progress(p jsonb, category text)
returns boolean language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; n numeric; s numeric; pos numeric;
begin
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p) loop
    if k not in ('position','total','season','seasons','episodes') then return false; end if;
    if k = 'episodes' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
    elsif v <> 'null'::jsonb then
      if jsonb_typeof(v) <> 'number' then return false; end if;
      n := v::text::numeric;
      if n <> trunc(n) or n > 1000000 or n < (case when k = 'position' and category <> 'dizi' then 0 else 1 end) then return false; end if;
    end if;
  end loop;
  for k, v in select * from jsonb_each(coalesce(p->'episodes', '{}'::jsonb)) loop
    if k !~ '^[1-9][0-9]{0,6}$' or k::numeric > 1000000 or jsonb_typeof(v) <> 'number' then return false; end if;
    n := v::text::numeric;
    if n < 1 or n > 1000000 or n <> trunc(n) or k::numeric > (p->>'seasons')::numeric then return false; end if;
  end loop;
  pos := (p->>'position')::numeric; s := (p->>'season')::numeric;
  if category = 'dizi' then
    if (pos is null) <> (s is null) then return false; end if;
    if s > (p->>'seasons')::numeric or pos > (p->'episodes'->>s::text)::numeric then return false; end if;
  elsif pos > (p->>'total')::numeric then return false;
  end if;
  return true;
exception when others then return false;
end;
$$;
alter table public.items drop constraint if exists items_progress_valid;
alter table public.items add constraint items_progress_valid check (public.valid_item_progress(progress, category));
commit;
