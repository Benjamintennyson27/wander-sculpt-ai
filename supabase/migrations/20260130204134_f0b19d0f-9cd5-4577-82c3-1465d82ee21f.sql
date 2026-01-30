-- Drop existing policies on trip_collaborators
DROP POLICY IF EXISTS "Trip owners can manage collaborators" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Users can accept/decline their invitations" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON public.trip_collaborators;

-- Create proper PERMISSIVE policies for trip_collaborators

-- Trip owners can view all collaborators on their trips
CREATE POLICY "Trip owners can view collaborators"
ON public.trip_collaborators
FOR SELECT
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
USING (user_id = auth.uid());

-- Trip owners can insert collaborators
CREATE POLICY "Trip owners can insert collaborators"
ON public.trip_collaborators
FOR INSERT
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
USING (user_id = auth.uid());

-- Trip owners can delete collaborators from their trips
CREATE POLICY "Trip owners can delete collaborators"
ON public.trip_collaborators
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
);