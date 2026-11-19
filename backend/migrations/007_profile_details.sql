-- Independent database only. Existing profile data is preserved.
ALTER TABLE collection.profiles ADD COLUMN revision integer NOT NULL DEFAULT 1;
CREATE FUNCTION collection.get_own_profile(p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); result jsonb;
BEGIN
  SELECT jsonb_build_object('id',id,'username',username,'display_name',display_name,'bio',bio,'revision',revision)
    INTO result FROM collection.profiles WHERE id=actor;
  IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0404',MESSAGE='Profil bulunamadı.'; END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION collection.update_own_profile(p_session text,p_revision integer,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); profile collection.profiles;
BEGIN
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR
    EXISTS(SELECT 1 FROM jsonb_each(p_data) e WHERE e.key NOT IN ('username','display_name','bio') OR jsonb_typeof(e.value)<>'string') THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Profil alanları geçersiz.';
  END IF;
  SELECT * INTO profile FROM collection.profiles WHERE id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0404',MESSAGE='Profil bulunamadı.'; END IF;
  IF p_revision IS DISTINCT FROM profile.revision THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Profil başka bir yerde değişmiş. Güncel bilgileri yükleyip tekrar dene.'; END IF;
  profile:=jsonb_populate_record(profile,p_data);
  profile.username:=translate(profile.username,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz');
  profile.display_name:=btrim(profile.display_name); profile.bio:=btrim(profile.bio);
  IF profile.username !~ '^[a-z][a-z0-9_.]{2,29}$' THEN RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Kullanıcı adı 3–30 karakter olmalı, harfle başlamalı; yalnızca a–z, 0–9, _ ve . içermeli.'; END IF;
  IF length(profile.display_name) NOT BETWEEN 1 AND 80 OR profile.display_name ~ '[[:cntrl:]]' OR length(profile.bio)>160 THEN
    RAISE EXCEPTION USING ERRCODE='P0400',MESSAGE='Ad soyad 1–80, biyografi en fazla 160 karakter olmalı.';
  END IF;
  BEGIN
    UPDATE collection.profiles SET username=profile.username,display_name=profile.display_name,bio=profile.bio,revision=revision+1 WHERE id=actor;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Bu kullanıcı adı zaten kullanılıyor.';
  END;
  RETURN collection.get_own_profile(p_session);
END;
$$;
REVOKE ALL ON FUNCTION collection.get_own_profile(text),collection.update_own_profile(text,integer,jsonb) FROM PUBLIC,collection_app;
GRANT EXECUTE ON FUNCTION collection.get_own_profile(text),collection.update_own_profile(text,integer,jsonb) TO collection_app;
