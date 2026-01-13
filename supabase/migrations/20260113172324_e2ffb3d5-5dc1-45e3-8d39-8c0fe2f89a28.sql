-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Service role can manage search cache" ON public.you_search_cache;

-- Create a policy that denies all access to regular users
-- Service role bypasses RLS, so it will still work for edge functions
CREATE POLICY "Deny public access to search cache"
ON public.you_search_cache
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);