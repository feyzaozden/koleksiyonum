-- One-use verification and recovery tokens; only hashes are persisted.
CREATE TABLE accounts.action_tokens (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK(purpose IN ('verify','reset')),
  expires_at timestamptz NOT NULL,
  UNIQUE(user_id,purpose)
);
ALTER TABLE accounts.action_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON accounts.action_tokens FROM PUBLIC,collection_app;

CREATE FUNCTION accounts.create_action_token(p_email text,p_purpose text,p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
  IF p_purpose IS NULL OR p_purpose NOT IN ('verify','reset') OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  SELECT id INTO target FROM accounts.users WHERE lower(email)=p_email;
  IF target IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(target::text,20261116));
  PERFORM 1 FROM accounts.users WHERE id=target AND disabled_at IS NULL
    AND ((p_purpose='verify' AND email_verified_at IS NULL) OR (p_purpose='reset' AND email_verified_at IS NOT NULL)) FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM accounts.action_tokens WHERE expires_at<=now();
  INSERT INTO accounts.action_tokens(token_hash,user_id,purpose,expires_at)
    VALUES(p_hash,target,p_purpose,now()+CASE WHEN p_purpose='verify' THEN interval '24 hours' ELSE interval '30 minutes' END)
    ON CONFLICT(user_id,purpose) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  RETURN true;
END;
$$;

CREATE FUNCTION accounts.consume_action_token(p_hash text,p_purpose text,p_password_hash text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
  IF p_purpose IS NULL OR p_purpose NOT IN ('verify','reset') THEN RETURN false; END IF;
  IF p_purpose='reset' AND (p_password_hash IS NULL OR p_password_hash !~ '^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$') THEN
    RAISE EXCEPTION 'invalid password hash';
  END IF;
  SELECT user_id INTO target FROM accounts.action_tokens WHERE token_hash=p_hash AND purpose=p_purpose;
  IF target IS NULL THEN RETURN false; END IF;
  -- Same lock order as issue_session prevents a concurrent login retaining an old password session.
  PERFORM pg_advisory_xact_lock(hashtextextended(target::text,20261116));
  PERFORM 1 FROM accounts.users WHERE id=target AND disabled_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM accounts.action_tokens WHERE token_hash=p_hash AND purpose=p_purpose AND expires_at>now();
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_purpose='verify' THEN
    UPDATE accounts.users SET email_verified_at=coalesce(email_verified_at,now()) WHERE id=target;
  ELSE
    UPDATE accounts.users SET password_hash=p_password_hash WHERE id=target;
    DELETE FROM accounts.sessions WHERE user_id=target;
    DELETE FROM accounts.action_tokens WHERE user_id=target;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION accounts.create_action_token(text,text,text),accounts.consume_action_token(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accounts.create_action_token(text,text,text),accounts.consume_action_token(text,text,text) TO collection_app;
