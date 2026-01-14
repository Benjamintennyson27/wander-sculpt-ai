-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.is_trip_collaborator(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = p_trip_id 
    AND user_id = p_user_id 
    AND status = 'accepted'
  );
$$;