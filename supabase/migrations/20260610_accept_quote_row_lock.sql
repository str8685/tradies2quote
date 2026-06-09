-- 2026-06-10 — applied to the live database 2026-06-10 (owner-approved).
--
-- Race fix for public.accept_quote: the function did SELECT → checks → UPDATE
-- without a row lock, so two concurrent accepts of the same token could both
-- pass the status guard and the second would silently overwrite the first
-- acceptance record (name, signature, IP) on a legally meaningful row.
--
-- Fix: FOR UPDATE on the initial read. The second transaction blocks until
-- the first commits, re-reads the row as 'accepted', and correctly returns
-- the 'already_accepted' error instead of overwriting.
--
-- Everything else is byte-identical to the live definition (verified against
-- pg_get_functiondef on 2026-06-10).

CREATE OR REPLACE FUNCTION public.accept_quote(p_token text, p_name text, p_email text, p_signature_path text, p_ip text, p_user_agent text, p_total numeric, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE q_record record;
BEGIN
  SELECT * INTO q_record FROM public.quotes WHERE public_token = p_token LIMIT 1 FOR UPDATE;
  IF q_record IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF q_record.expires_at IS NOT NULL AND q_record.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;
  IF q_record.status = 'accepted' THEN
    RETURN jsonb_build_object('error', 'already_accepted');
  END IF;
  UPDATE public.quotes SET
    status = 'accepted', accepted_at = now(), accepted_name = p_name,
    accepted_email = p_email, signature_path = p_signature_path,
    accepted_ip = p_ip, accepted_user_agent = p_user_agent,
    accepted_total = p_total, accepted_quote_version = p_version
  WHERE id = q_record.id;
  INSERT INTO public.quote_events (quote_id, type, metadata)
    VALUES (q_record.id, 'accepted', jsonb_build_object('name', p_name));
  RETURN jsonb_build_object('ok', true, 'quote_id', q_record.id);
END $function$;
