-- Create table to store web-enriched destination facts (POIs and food spots)
CREATE TABLE public.destination_facts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  trip_type TEXT, -- family, solo, friends, etc.
  food_preference TEXT,
  
  -- Attractions/POIs (JSON array)
  attractions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{name, type, area, reason, maps_query, source_url}]
  
  -- Food spots (JSON array)
  food_spots JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{name, area, cuisine_type, maps_query, source_url}]
  
  -- Metadata
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  model_used TEXT,
  raw_response JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.destination_facts ENABLE ROW LEVEL SECURITY;

-- Only trip owner can view their destination facts
CREATE POLICY "Users can view their own destination facts"
ON public.destination_facts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trips 
    WHERE trips.id = destination_facts.trip_id 
    AND trips.user_id = auth.uid()
  )
);

-- Only trip owner can insert destination facts
CREATE POLICY "Users can insert their own destination facts"
ON public.destination_facts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips 
    WHERE trips.id = destination_facts.trip_id 
    AND trips.user_id = auth.uid()
  )
);

-- Only trip owner can delete their destination facts
CREATE POLICY "Users can delete their own destination facts"
ON public.destination_facts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.trips 
    WHERE trips.id = destination_facts.trip_id 
    AND trips.user_id = auth.uid()
  )
);

-- Add maps_query column to itinerary_items table
ALTER TABLE public.itinerary_items 
ADD COLUMN IF NOT EXISTS maps_query TEXT;

-- Create index for faster lookups
CREATE INDEX idx_destination_facts_trip_id ON public.destination_facts(trip_id);
CREATE INDEX idx_destination_facts_destination ON public.destination_facts(destination);