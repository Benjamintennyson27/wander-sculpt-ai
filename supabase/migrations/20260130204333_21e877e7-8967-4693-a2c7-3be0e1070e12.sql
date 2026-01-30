-- Fix trip_collaborators to use TO authenticated role
DROP POLICY IF EXISTS "Trip owners can view collaborators" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Users can view own invitation" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Trip owners can insert collaborators" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Trip owners can update collaborators" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Users can update own invitation" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Trip owners can delete collaborators" ON public.trip_collaborators;

-- Force RLS for table owner
ALTER TABLE public.trip_collaborators FORCE ROW LEVEL SECURITY;

-- Trip owners can view all collaborators on their trips
CREATE POLICY "Trip owners can view collaborators"
ON public.trip_collaborators
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
);

-- Invited users can view only their own invitation
CREATE POLICY "Users can view own invitation"
ON public.trip_collaborators
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Trip owners can insert collaborators
CREATE POLICY "Trip owners can insert collaborators"
ON public.trip_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
);

-- Trip owners can update collaborators on their trips
CREATE POLICY "Trip owners can update collaborators"
ON public.trip_collaborators
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
);

-- Invited users can update their own invitation (accept/decline)
CREATE POLICY "Users can update own invitation"
ON public.trip_collaborators
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Trip owners can delete collaborators from their trips
CREATE POLICY "Trip owners can delete collaborators"
ON public.trip_collaborators
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
);