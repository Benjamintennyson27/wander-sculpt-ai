-- Fix trip_share_tokens table - require authentication for all operations
DROP POLICY IF EXISTS "Users can create share tokens for own trips" ON public.trip_share_tokens;
DROP POLICY IF EXISTS "Users can delete own share tokens" ON public.trip_share_tokens;
DROP POLICY IF EXISTS "Users can view own share tokens" ON public.trip_share_tokens;

-- Recreate policies with explicit authenticated role requirement
CREATE POLICY "Users can create share tokens for own trips"
ON public.trip_share_tokens
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM trips
  WHERE trips.id = trip_share_tokens.trip_id
  AND trips.user_id = auth.uid()
));

CREATE POLICY "Users can delete own share tokens"
ON public.trip_share_tokens
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM trips
  WHERE trips.id = trip_share_tokens.trip_id
  AND trips.user_id = auth.uid()
));

CREATE POLICY "Users can view own share tokens"
ON public.trip_share_tokens
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM trips
  WHERE trips.id = trip_share_tokens.trip_id
  AND trips.user_id = auth.uid()
));