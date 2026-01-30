-- Drop existing policies on trips table
DROP POLICY IF EXISTS "Collaborators can view shared trips" ON public.trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can insert own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can view own trips" ON public.trips;

-- Ensure RLS is enabled
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (extra security)
ALTER TABLE public.trips FORCE ROW LEVEL SECURITY;

-- Create PERMISSIVE policies that require authentication

-- Users can view their own trips (requires authenticated user)
CREATE POLICY "Users can view own trips"
ON public.trips
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Collaborators can view shared trips (requires authenticated user)
CREATE POLICY "Collaborators can view shared trips"
ON public.trips
FOR SELECT
TO authenticated
USING (is_trip_collaborator(id, auth.uid()));

-- Users can insert their own trips (requires authenticated user)
CREATE POLICY "Users can insert own trips"
ON public.trips
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own trips (requires authenticated user)
CREATE POLICY "Users can update own trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own trips (requires authenticated user)
CREATE POLICY "Users can delete own trips"
ON public.trips
FOR DELETE
TO authenticated
USING (user_id = auth.uid());