-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view own trips or collaborated trips" ON public.trips;

-- Create a simpler non-recursive policy for viewing trips
CREATE POLICY "Users can view own trips" 
ON public.trips 
FOR SELECT 
USING (user_id = auth.uid());

-- Create a separate function to check collaboration (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_trip_collaborator(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = p_trip_id 
    AND user_id = p_user_id 
    AND status = 'accepted'
  );
$$;

-- Create policy for collaborators to view trips using the function
CREATE POLICY "Collaborators can view shared trips" 
ON public.trips 
FOR SELECT 
USING (public.is_trip_collaborator(id, auth.uid()));

-- Also fix the itineraries policy which has the same issue
DROP POLICY IF EXISTS "Users can view itineraries for own or collaborated trips" ON public.itineraries;
DROP POLICY IF EXISTS "Users can update itineraries for own or collaborated trips" ON public.itineraries;

-- Create simpler policies for itineraries
CREATE POLICY "Users can view itineraries for own trips" 
ON public.itineraries 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.trips 
  WHERE trips.id = itineraries.trip_id 
  AND trips.user_id = auth.uid()
));

CREATE POLICY "Collaborators can view shared itineraries" 
ON public.itineraries 
FOR SELECT 
USING (public.is_trip_collaborator(trip_id, auth.uid()));

CREATE POLICY "Users can update itineraries for own trips" 
ON public.itineraries 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.trips 
  WHERE trips.id = itineraries.trip_id 
  AND trips.user_id = auth.uid()
));

CREATE POLICY "Collaborator editors can update itineraries" 
ON public.itineraries 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_collaborators.trip_id = itineraries.trip_id 
    AND trip_collaborators.user_id = auth.uid() 
    AND trip_collaborators.status = 'accepted'
    AND trip_collaborators.role IN ('editor', 'admin')
  )
);