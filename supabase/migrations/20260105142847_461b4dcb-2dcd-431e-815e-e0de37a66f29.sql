-- Fix you_search_cache - remove the policy that allows any authenticated user to read
DROP POLICY IF EXISTS "Authenticated users can read search cache" ON public.you_search_cache;

-- Add UPDATE policies for missing tables

-- itinerary_items UPDATE policy (add if doesn't exist)
DROP POLICY IF EXISTS "Users can update own itinerary items" ON public.itinerary_items;
CREATE POLICY "Users can update own itinerary items"
ON public.itinerary_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM itinerary_days d
    JOIN itineraries i ON i.id = d.itinerary_id
    JOIN trips t ON t.id = i.trip_id
    WHERE d.id = itinerary_items.itinerary_day_id
    AND t.user_id = auth.uid()
  )
);

-- itinerary_days UPDATE policy
DROP POLICY IF EXISTS "Users can update own itinerary days" ON public.itinerary_days;
CREATE POLICY "Users can update own itinerary days"
ON public.itinerary_days FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM itineraries i
    JOIN trips t ON t.id = i.trip_id
    WHERE i.id = itinerary_days.itinerary_id
    AND t.user_id = auth.uid()
  )
);

-- destination_facts UPDATE policy
DROP POLICY IF EXISTS "Users can update own destination facts" ON public.destination_facts;
CREATE POLICY "Users can update own destination facts"
ON public.destination_facts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trips t
    WHERE t.id = destination_facts.trip_id
    AND t.user_id = auth.uid()
  )
);

-- itinerary_item_facts UPDATE policy
DROP POLICY IF EXISTS "Users can update own item facts" ON public.itinerary_item_facts;
CREATE POLICY "Users can update own item facts"
ON public.itinerary_item_facts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM itinerary_items ii
    JOIN itinerary_days d ON d.id = ii.itinerary_day_id
    JOIN itineraries i ON i.id = d.itinerary_id
    JOIN trips t ON t.id = i.trip_id
    WHERE ii.id = itinerary_item_facts.itinerary_item_id
    AND t.user_id = auth.uid()
  )
);