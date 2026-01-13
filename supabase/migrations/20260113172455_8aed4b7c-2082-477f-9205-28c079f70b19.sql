-- Fix rate_limits table - require authentication
DROP POLICY IF EXISTS "Users can insert own rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Users can update own rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Users can view own rate limits" ON public.rate_limits;

CREATE POLICY "Users can insert own rate limits"
ON public.rate_limits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rate limits"
ON public.rate_limits
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own rate limits"
ON public.rate_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix you_search_rate_limits table - require authentication
DROP POLICY IF EXISTS "Users can insert own search rate limits" ON public.you_search_rate_limits;
DROP POLICY IF EXISTS "Users can update own search rate limits" ON public.you_search_rate_limits;
DROP POLICY IF EXISTS "Users can view own search rate limits" ON public.you_search_rate_limits;

CREATE POLICY "Users can insert own search rate limits"
ON public.you_search_rate_limits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own search rate limits"
ON public.you_search_rate_limits
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own search rate limits"
ON public.you_search_rate_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);