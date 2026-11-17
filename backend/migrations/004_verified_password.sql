-- Email owner chooses their password on confirmation, invalidating any pre-registration password.
CREATE FUNCTION accounts.confirm_email_with_password(p_hash text,p_password_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
  IF p_password_hash IS NULL OR p_password_hash !~ '^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'invalid password hash';
  END IF;
  SELECT user_id INTO target FROM accounts.action_tokens WHERE token_hash=p_hash AND purpose='verify';
  IF target IS NULL THEN RETURN false; END IF;
  -- consume_action_token acquires the shared account lock until transaction end.
  IF NOT accounts.consume_action_token(p_hash,'verify',NULL) THEN RETURN false; END IF;
  UPDATE accounts.users SET password_hash=p_password_hash WHERE id=target;
  DELETE FROM accounts.sessions WHERE user_id=target;
  DELETE FROM accounts.action_tokens WHERE user_id=target;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION accounts.confirm_email_with_password(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accounts.confirm_email_with_password(text,text) TO collection_app;
