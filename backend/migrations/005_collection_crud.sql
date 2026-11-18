-- Independent database only: ownership is resolved from a session hash, never a client user_id.
ALTER TABLE collection.items ADD COLUMN revision integer NOT NULL DEFAULT 1;
CREATE TABLE collection.daily_item_usage (
  user_id uuid REFERENCES accounts.users(id) ON DELETE CASCADE,
  day date NOT NULL, used integer NOT NULL CHECK(used BETWEEN 0 AND 100),
  PRIMARY KEY(user_id,day)
);
ALTER TABLE collection.daily_item_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON collection.daily_item_usage FROM PUBLIC,collection_app;

CREATE FUNCTION collection.require_actor(p_session text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;
BEGIN
  SELECT u.id INTO actor FROM accounts.sessions s JOIN accounts.users u ON u.id=s.user_id
    WHERE s.token_hash=p_session AND s.expires_at>now() AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL;
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0401',MESSAGE='Giriş yapıp e-posta adresini doğrula.'; END IF;
  RETURN actor;
END;
$$;

CREATE FUNCTION collection.identity_part(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT btrim(regexp_replace(translate(lower(translate(normalize(coalesce(value,''),NFKC),'İ','i')),'ı','i'),'[[:space:]]+',' ','g'));
$$;

CREATE FUNCTION collection.guard_manual_item() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE today date := (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
  NEW.title:=btrim(NEW.title); NEW.creator:=nullif(btrim(NEW.creator),''); NEW.year:=nullif(btrim(NEW.year),'');
  IF NEW.title IS NULL OR collection.identity_part(NEW.title)='' OR length(NEW.title) NOT BETWEEN 1 AND 300 OR NEW.title ~ '[[:cntrl:]]'
    OR length(NEW.creator)>300 OR NEW.creator ~ '[[:cntrl:]]' OR length(NEW.note)>3000 OR length(NEW.emoji)>16 THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Başlık, yazar veya not bilgisi geçersiz.';
  END IF;
  IF NEW.year IS NOT NULL THEN
    IF NEW.year !~ '^[0-9]{1,4}$' THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Geçerli bir yıl gir.'; END IF;
    IF NEW.year::integer NOT BETWEEN 1 AND extract(year FROM today)::integer THEN
      RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Yıl bu yıldan ileri olamaz.';
    END IF;
    NEW.year:=NEW.year::integer::text;
  END IF;
  IF NEW.start_date>today OR NEW.end_date>today OR NEW.end_date<NEW.start_date THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Tarihler gelecekte olamaz; bitiş başlangıçtan önce olamaz.';
  END IF;
  IF NEW.source IS NULL AND NEW.music_recording_id IS NULL AND NEW.youtube_source_id IS NULL THEN
    NEW.dedupe_key:=md5(jsonb_build_array(collection.identity_part(NEW.title),collection.identity_part(NEW.creator),coalesce(NEW.year,''))::text);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_manual_item BEFORE INSERT OR UPDATE ON collection.items FOR EACH ROW EXECUTE FUNCTION collection.guard_manual_item();

CREATE FUNCTION collection.list_own_items(p_session text,p_category text,p_limit integer,p_offset integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); result jsonb;
BEGIN
  IF p_category IS NOT NULL AND p_category NOT IN ('kitap','film','dizi','muzik') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Geçersiz listeleme parametresi.';
  END IF;
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(q.item ORDER BY q.position),'[]'::jsonb)) INTO result FROM (
    SELECT to_jsonb(i)||jsonb_build_object('id',i.id::text) AS item,
      row_number() OVER(ORDER BY coalesce(i.end_date,i.start_date) DESC NULLS LAST,i.added_at DESC,i.id DESC) AS position
    FROM collection.items i WHERE i.user_id=actor AND (p_category IS NULL OR i.category=p_category)
    ORDER BY coalesce(i.end_date,i.start_date) DESC NULLS LAST,i.added_at DESC,i.id DESC LIMIT p_limit OFFSET p_offset
  ) q;
  RETURN result||jsonb_build_object('total',(SELECT count(*) FROM collection.items i WHERE i.user_id=actor AND (p_category IS NULL OR i.category=p_category)));
END;
$$;

CREATE FUNCTION collection.write_own_item(p_session text,p_id bigint,p_revision integer,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); item collection.items; old_item collection.items; used_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,20261118));
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Geçersiz içerik.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE k NOT IN ('category','title','creator','year','status','note','start_date','end_date','rating','emoji')) THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Bu alan bu işlemde değiştirilemez.';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_data) e WHERE e.key<>'rating' AND jsonb_typeof(e.value) NOT IN ('string','null')) THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Geçersiz alan türü.';
  END IF;
  IF p_data ? 'rating' AND jsonb_typeof(p_data->'rating') NOT IN ('number','null') THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Puan sayı olmalı.';
  END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO old_item FROM collection.items WHERE id=p_id AND user_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0404',MESSAGE='İçerik bulunamadı.'; END IF;
    IF p_revision IS DISTINCT FROM old_item.revision THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Kayıt değişmiş. Listeyi yenileyip tekrar dene.'; END IF;
    -- Verified catalog metadata is not editable through this manual route.
    IF old_item.source IS NOT NULL OR old_item.music_recording_id IS NOT NULL OR old_item.youtube_source_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Katalog içerikleri için ayrı düzenleme akışı gerekli.';
    END IF;
  ELSE
    old_item.user_id:=actor; old_item.status:='bekliyor';
  END IF;
  item:=jsonb_populate_record(old_item,p_data);
  IF item.category IS NULL OR item.category NOT IN ('kitap','film','dizi','muzik') OR item.status IS NULL OR item.status NOT IN ('bekliyor','devam','bitti') THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Kategori veya durum geçersiz.';
  END IF;
  IF item.category='muzik' THEN item.status:='bekliyor'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO collection.daily_item_usage AS d(user_id,day,used)
      VALUES(actor,(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date,1)
      ON CONFLICT(user_id,day) DO UPDATE SET used=d.used+1 WHERE d.used<100 RETURNING used INTO used_count;
    IF used_count IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0429',MESSAGE='Günlük ekleme sınırına ulaştın. Yarın tekrar deneyebilirsin.'; END IF;
    INSERT INTO collection.items(user_id,category,title,creator,year,status,note,start_date,end_date,rating,emoji)
      VALUES(actor,item.category,item.title,item.creator,item.year,item.status,item.note,item.start_date,item.end_date,item.rating,item.emoji) RETURNING * INTO item;
  ELSE
    UPDATE collection.items SET category=item.category,title=item.title,creator=item.creator,year=item.year,status=item.status,note=item.note,
      start_date=item.start_date,end_date=item.end_date,rating=item.rating,emoji=item.emoji,revision=revision+1
      WHERE id=p_id AND user_id=actor RETURNING * INTO item;
  END IF;
  RETURN to_jsonb(item)||jsonb_build_object('id',item.id::text);
END;
$$;

CREATE FUNCTION collection.delete_own_item(p_session text,p_id bigint,p_revision integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); current_revision integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,20261118));
  SELECT revision INTO current_revision FROM collection.items WHERE id=p_id AND user_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0404',MESSAGE='İçerik bulunamadı.'; END IF;
  IF p_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Kayıt değişmiş. Listeyi yenileyip tekrar dene.'; END IF;
  DELETE FROM collection.items WHERE id=p_id AND user_id=actor;
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA collection FROM PUBLIC,collection_app;
GRANT USAGE ON SCHEMA collection TO collection_app;
GRANT EXECUTE ON FUNCTION collection.list_own_items(text,text,integer,integer),collection.write_own_item(text,bigint,integer,jsonb),collection.delete_own_item(text,bigint,integer) TO collection_app;
