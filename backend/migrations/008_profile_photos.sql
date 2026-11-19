-- Small, normalized avatars are stored with the independent database backup.
CREATE TABLE collection.profile_photos (
  user_id uuid PRIMARY KEY REFERENCES collection.profiles(id) ON DELETE CASCADE,
  image bytea NOT NULL CHECK(octet_length(image) BETWEEN 1 AND 524288)
);
ALTER TABLE collection.profile_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON collection.profile_photos FROM PUBLIC,collection_app;

CREATE OR REPLACE FUNCTION collection.get_own_profile(p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); result jsonb;
BEGIN
  SELECT jsonb_build_object('id',id,'username',username,'display_name',display_name,'bio',bio,'revision',revision,
    'has_photo',EXISTS(SELECT 1 FROM collection.profile_photos WHERE user_id=actor)) INTO result
    FROM collection.profiles WHERE id=actor;
  IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0404',MESSAGE='Profil bulunamadı.'; END IF;
  RETURN result;
END;
$$;
CREATE FUNCTION collection.get_own_photo(p_session text) RETURNS bytea
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session);
BEGIN
  RETURN (SELECT image FROM collection.profile_photos WHERE user_id=actor);
END;
$$;
CREATE FUNCTION collection.set_own_photo(p_session text,p_revision integer,p_image bytea) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := collection.require_actor(p_session); current_revision integer;
BEGIN
  SELECT revision INTO current_revision FROM collection.profiles WHERE id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0404',MESSAGE='Profil bulunamadı.'; END IF;
  IF current_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION USING ERRCODE='P0409',MESSAGE='Profil değişmiş. Güncel profili yükleyip tekrar dene.'; END IF;
  IF p_image IS NULL THEN DELETE FROM collection.profile_photos WHERE user_id=actor;
  ELSE INSERT INTO collection.profile_photos(user_id,image) VALUES(actor,p_image)
    ON CONFLICT(user_id) DO UPDATE SET image=EXCLUDED.image;
  END IF;
  UPDATE collection.profiles SET revision=revision+1 WHERE id=actor;
  RETURN collection.get_own_profile(p_session);
END;
$$;
REVOKE ALL ON FUNCTION collection.get_own_photo(text),collection.set_own_photo(text,integer,bytea) FROM PUBLIC,collection_app;
GRANT EXECUTE ON FUNCTION collection.get_own_photo(text),collection.set_own_photo(text,integer,bytea) TO collection_app;
