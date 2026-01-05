-- Add RLS policy for you_search_cache table
-- Using shared cache design - all authenticated users can read from cache
CREATE POLICY "Authenticated users can read search cache"
ON public.you_search_cache
FOR SELECT
TO authenticated
USING (expires_at > now());

-- Service role can insert/update cache entries (from edge functions)
CREATE POLICY "Service role can manage search cache"
ON public.you_search_cache
FOR ALL
USING (true)
WITH CHECK (true);