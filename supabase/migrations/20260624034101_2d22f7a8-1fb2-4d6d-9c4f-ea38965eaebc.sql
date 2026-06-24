
-- Harden profiles: prevent client access to sensitive payment identifiers.
-- RLS already restricts rows to auth.uid(); additionally restrict columns so
-- Stripe identifiers and billing period internals are only readable by
-- service_role (used by edge functions/webhooks).
REVOKE SELECT (stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end)
  ON public.profiles FROM authenticated;
REVOKE UPDATE (stripe_customer_id, stripe_subscription_id, subscription_status, plan, current_period_start, current_period_end, period_generations_used, lifetime_generations_used)
  ON public.profiles FROM authenticated;

-- Ensure service_role retains full access for edge functions/webhooks.
GRANT ALL ON public.profiles TO service_role;

-- trip_collaborators: explicitly document that only the trip owner and the
-- specific invited user can see a given collaborator row (already enforced by
-- existing policies; no other collaborator can read peer emails).
COMMENT ON TABLE public.trip_collaborators IS
  'Collaborator rows are visible only to the trip owner and the specific invited user (enforced by RLS). Peer collaborators cannot see each other''s emails.';

-- you_search_cache: document service-role-only access expectation.
COMMENT ON TABLE public.you_search_cache IS
  'Cache table. All client (anon/authenticated) access is denied by RLS. Only edge functions using service_role may read/write. Do not expose this table through any client API.';
