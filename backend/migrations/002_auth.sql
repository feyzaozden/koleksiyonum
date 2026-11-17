-- Auth is accessible only through narrow functions. No direct runtime table access.
ALTER TABLE collection.profiles DROP CONSTRAINT profiles_username_check;
ALTER TABLE collection.profiles ADD CONSTRAINT profiles_username_check CHECK(username ~ '^[a-z][a-z0-9_.]{2,29}$');

CREATE TABLE accounts.sessions (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
CREATE INDEX sessions_user ON accounts.sessions(user_id,created_at);
CREATE TABLE accounts.auth_limits (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1
);
ALTER TABLE accounts.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts.auth_limits ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION accounts.consume_auth_limit(p_bucket text,p_limit integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE used integer;
BEGIN
  IF length(p_bucket)>100 OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid limit'; END IF;
  DELETE FROM accounts.auth_limits WHERE window_start < now()-interval '1 day';
  INSERT INTO accounts.auth_limits AS limits(bucket) VALUES(p_bucket)
  ON CONFLICT(bucket) DO UPDATE SET
    attempts=CASE WHEN limits.window_start<=now()-interval '15 minutes' THEN 1 ELSE least(limits.attempts+1,101) END,
    window_start=CASE WHEN limits.window_start<=now()-interval '15 minutes' THEN now() ELSE limits.window_start END
  RETURNING attempts INTO used;
  RETURN used<=p_limit;
END;
$$;

CREATE FUNCTION accounts.register_user(p_email text,p_hash text,p_username text,p_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
  IF p_email IS NULL OR length(p_email)>254 OR p_email<>lower(btrim(p_email))
    OR p_hash IS NULL OR p_hash !~ '^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$'
    OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid registration'; END IF;
  INSERT INTO accounts.users(email,password_hash) VALUES(p_email,p_hash) RETURNING id INTO result;
  INSERT INTO collection.profiles(id,username,display_name) VALUES(result,p_username,btrim(p_name));
  RETURN result;
END;
$$;

CREATE FUNCTION accounts.login_candidate(p_email text)
RETURNS TABLE(id uuid,password_hash text) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT u.id,u.password_hash FROM accounts.users u WHERE lower(u.email)=p_email;
$$;

CREATE FUNCTION accounts.issue_session(p_user uuid,p_expected_hash text,p_token_hash text,p_old_hash text,p_local_unverified boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,20261116));
  PERFORM 1 FROM accounts.users WHERE id=p_user AND password_hash=p_expected_hash AND disabled_at IS NULL
    AND (email_verified_at IS NOT NULL OR p_local_unverified IS TRUE) FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM accounts.sessions WHERE expires_at<=now() OR token_hash=p_old_hash;
  DELETE FROM accounts.sessions WHERE token_hash IN (
    SELECT token_hash FROM accounts.sessions WHERE user_id=p_user ORDER BY created_at DESC OFFSET 9
  );
  INSERT INTO accounts.sessions(token_hash,user_id) VALUES(p_token_hash,p_user);
  RETURN true;
END;
$$;

CREATE FUNCTION accounts.session_user(p_token_hash text)
RETURNS TABLE(id uuid,email text,username text,display_name text,email_verified boolean)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT u.id,u.email,p.username,p.display_name,u.email_verified_at IS NOT NULL
  FROM accounts.sessions s JOIN accounts.users u ON u.id=s.user_id JOIN collection.profiles p ON p.id=u.id
  WHERE s.token_hash=p_token_hash AND s.expires_at>now() AND u.disabled_at IS NULL;
$$;

CREATE FUNCTION accounts.revoke_session(p_token_hash text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  DELETE FROM accounts.sessions WHERE token_hash=p_token_hash;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA accounts FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA accounts FROM PUBLIC,collection_app;
GRANT USAGE ON SCHEMA accounts TO collection_app;
GRANT EXECUTE ON FUNCTION accounts.consume_auth_limit(text,integer),accounts.register_user(text,text,text,text),
  accounts.login_candidate(text),accounts.issue_session(uuid,text,text,text,boolean),accounts.session_user(text),accounts.revoke_session(text)
  TO collection_app;
