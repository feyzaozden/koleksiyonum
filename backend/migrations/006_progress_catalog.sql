-- Independent database only. Preserve earlier migration checksums.
CREATE FUNCTION collection.validate_progress() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb := NEW.progress; k text; v jsonb; n numeric;
BEGIN
  IF jsonb_typeof(p)<>'object' OR octet_length(p::text)>8000 THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='İlerleme bilgisi geçersiz.'; END IF;
  FOR k,v IN SELECT * FROM jsonb_each(p) LOOP
    IF k NOT IN ('position','total','season','seasons','episodes') OR
      (NEW.category IN ('kitap','film') AND k NOT IN ('position','total')) OR NEW.category='muzik' OR
      (NEW.category='dizi' AND k='total') THEN
      RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Bu kategori için ilerleme alanı geçersiz.';
    END IF;
    IF k='episodes' THEN
      IF jsonb_typeof(v)<>'object' THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Bölüm bilgisi geçersiz.'; END IF;
    ELSIF v<>'null'::jsonb THEN
      IF jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='İlerleme tam sayı olmalı.'; END IF;
      n:=(v::text)::numeric;
      IF n<>trunc(n) OR n>1000000 OR n<(CASE WHEN k='position' AND NEW.category<>'dizi' THEN 0 ELSE 1 END) THEN
        RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='İlerleme değeri geçersiz.';
      END IF;
    END IF;
  END LOOP;
  FOR k,v IN SELECT * FROM jsonb_each(coalesce(p->'episodes','{}')) LOOP
    IF k !~ '^[1-9][0-9]{0,6}$' OR jsonb_typeof(v)<>'number' THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Sezon bölüm bilgisi geçersiz.'; END IF;
    n:=(v::text)::numeric;
    IF k::numeric>1000000 OR n<>trunc(n) OR n NOT BETWEEN 1 AND 1000000 OR k::numeric>(p->>'seasons')::numeric THEN
      RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Sezon bölüm bilgisi geçersiz.';
    END IF;
  END LOOP;
  IF NEW.category='dizi' THEN
    IF ((p->>'season') IS NULL) <> ((p->>'position') IS NULL) OR
      (p->>'season')::numeric>(p->>'seasons')::numeric OR
      (p->>'position')::numeric>(p->'episodes'->>(p->>'season'))::numeric THEN
      RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Sezon ve bölüm değerlerini kontrol et.';
    END IF;
  ELSIF (p->>'position')::numeric>(p->>'total')::numeric THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='İlerleme toplam değeri aşamaz.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_progress BEFORE INSERT OR UPDATE ON collection.items FOR EACH ROW EXECUTE FUNCTION collection.validate_progress();

ALTER FUNCTION collection.write_own_item(text,bigint,integer,jsonb) RENAME TO write_manual_internal;
REVOKE ALL ON FUNCTION collection.write_manual_internal(text,bigint,integer,jsonb) FROM PUBLIC,collection_app;
CREATE FUNCTION collection.write_own_item(p_session text,p_id bigint,p_revision integer,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); old_item collection.items; result jsonb; target bigint; personal jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,20261118));
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Geçersiz içerik.'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO old_item FROM collection.items WHERE id=p_id AND user_id=actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0404',MESSAGE='İçerik bulunamadı.'; END IF;
    IF old_item.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Kayıt değişmiş. Listeyi yenileyip tekrar dene.'; END IF;
  END IF;
  IF old_item.source='tmdb' THEN
    personal:=p_data-'progress';
    -- The form may repeat immutable metadata, but cannot change it.
    IF EXISTS(SELECT 1 FROM jsonb_each(personal) e WHERE
      (e.key IN ('title','creator','year','category') AND e.value IS DISTINCT FROM to_jsonb(old_item)->e.key) OR
      e.key NOT IN ('title','creator','year','category','status','note','start_date','end_date','rating')) THEN
      RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Katalog bilgileri değiştirilemez.';
    END IF;
    old_item:=jsonb_populate_record(old_item,personal);
    UPDATE collection.items SET status=old_item.status,note=old_item.note,start_date=old_item.start_date,
      end_date=old_item.end_date,rating=old_item.rating,revision=revision+1
      WHERE id=p_id AND user_id=actor RETURNING to_jsonb(items)||jsonb_build_object('id',id::text) INTO result;
  ELSE
    result:=collection.write_manual_internal(p_session,p_id,p_revision,p_data-'progress');
  END IF;
  target:=(result->>'id')::bigint;
  IF p_data ? 'progress' THEN
    UPDATE collection.items SET progress=p_data->'progress' WHERE id=target AND user_id=actor
      RETURNING to_jsonb(items)||jsonb_build_object('id',id::text) INTO result;
  END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION collection.create_catalog_item(p_session text,p_data jsonb,p_catalog jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); result jsonb; target bigint;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE k NOT IN ('status','note','start_date','end_date','rating','progress')) THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Geçersiz kişisel alan.';
  END IF;
  IF p_catalog->>'category' NOT IN ('film','dizi') OR coalesce(p_catalog->>'category','')='' OR
    coalesce(p_catalog->>'id','') !~ '^[1-9][0-9]{0,9}$' OR
    (p_catalog->>'poster_path' IS NOT NULL AND p_catalog->>'poster_path' !~ '^/[a-zA-Z0-9_-]+\.(jpg|png|webp)$') THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Katalog bilgisi geçersiz.';
  END IF;
  result:=collection.write_own_item(p_session,NULL,NULL,p_data||jsonb_build_object(
    'category',p_catalog->>'category','title',p_catalog->>'title','creator',p_catalog->>'creator','year',nullif(p_catalog->>'year','')));
  target:=(result->>'id')::bigint;
  UPDATE collection.items SET source='tmdb',source_id=(p_catalog->>'id')::bigint,poster_path=p_catalog->>'poster_path'
    WHERE id=target AND user_id=actor RETURNING to_jsonb(items)||jsonb_build_object('id',id::text) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION collection.validate_progress(),collection.write_own_item(text,bigint,integer,jsonb),collection.create_catalog_item(text,jsonb,jsonb) FROM PUBLIC,collection_app;
GRANT EXECUTE ON FUNCTION collection.write_own_item(text,bigint,integer,jsonb),collection.create_catalog_item(text,jsonb,jsonb),collection.require_actor(text) TO collection_app;
