
-- 1) CREATE TABLE
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text
);

CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_action_idx ON public.audit_log (action);
CREATE INDEX audit_log_actor_user_id_idx ON public.audit_log (actor_user_id);
CREATE INDEX audit_log_target_idx ON public.audit_log (target_type, target_id);

-- 2) GRANTS
-- Authenticated cannot write directly; reads are admin-only via RLS.
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- 3) RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 4) POLICIES — only admins can read; no INSERT/UPDATE/DELETE for end users.
CREATE POLICY "Admins can view audit log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Helper: backend logging function (SECURITY DEFINER so edge functions can call via RPC).
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_actor_user_id uuid DEFAULT NULL,
  p_actor_email text DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_log (
    action, actor_user_id, actor_email, target_type, target_id,
    metadata, ip_address, user_agent
  )
  VALUES (
    p_action, p_actor_user_id, p_actor_email, p_target_type, p_target_id,
    COALESCE(p_metadata, '{}'::jsonb), p_ip_address, p_user_agent
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Only service_role can call the logging RPC (edge functions); deny anon/authenticated.
REVOKE ALL ON FUNCTION public.log_audit_event(text, uuid, text, text, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, uuid, text, text, text, jsonb, text, text) TO service_role;
