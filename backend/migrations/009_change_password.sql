-- Independent database only. Compare-and-swap prevents stale password checks.
CREATE FUNCTION accounts.password_candidate_for_session(p_session text)
RETURNS TABLE(id uuid,password_hash text)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT u.id,u.password_hash FROM accounts.users u JOIN accounts.sessions s ON s.user_id=u.id
  WHERE s.token_hash=p_session AND s.expires_at>now() AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL;
$$;

CREATE FUNCTION accounts.change_password(p_session text,p_expected_hash text,p_new_hash text,p_next_session text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;
BEGIN
  IF p_new_hash IS NULL OR p_new_hash !~ '^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$'
    OR p_next_session IS NULL OR p_next_session !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid credential format'; END IF;
  SELECT user_id INTO actor FROM accounts.sessions WHERE token_hash=p_session;
  IF actor IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,20261116));
  PERFORM 1 FROM accounts.users WHERE id=actor AND password_hash=p_expected_hash AND disabled_at IS NULL
    AND email_verified_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM accounts.sessions WHERE token_hash=p_session AND user_id=actor AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE accounts.users SET password_hash=p_new_hash WHERE id=actor;
  DELETE FROM accounts.sessions WHERE user_id=actor;
  DELETE FROM accounts.action_tokens WHERE user_id=actor;
  INSERT INTO accounts.sessions(token_hash,user_id) VALUES(p_next_session,actor);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION accounts.password_candidate_for_session(text),accounts.change_password(text,text,text,text) FROM PUBLIC,collection_app;
GRANT EXECUTE ON FUNCTION accounts.password_candidate_for_session(text),accounts.change_password(text,text,text,text) TO collection_app;
