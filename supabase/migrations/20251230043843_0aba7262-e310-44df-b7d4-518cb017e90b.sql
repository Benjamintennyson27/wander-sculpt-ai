-- Create trip_settings table
CREATE TABLE public.trip_settings (
  trip_id UUID PRIMARY KEY REFERENCES public.trips(id) ON DELETE CASCADE,
  auto_verify BOOLEAN NOT NULL DEFAULT true,
  verify_mode TEXT NOT NULL DEFAULT 'balanced' CHECK (verify_mode IN ('fast', 'balanced', 'strict')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for trip_settings
CREATE POLICY "Users can view own trip settings" 
ON public.trip_settings FOR SELECT 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_settings.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can insert own trip settings" 
ON public.trip_settings FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_settings.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can update own trip settings" 
ON public.trip_settings FOR UPDATE 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_settings.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can delete own trip settings" 
ON public.trip_settings FOR DELETE 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_settings.trip_id AND trips.user_id = auth.uid()));

-- Create place_verifications table
CREATE TABLE public.place_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  itinerary_item_id UUID NOT NULL,
  query TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('verified', 'partial', 'unverified', 'failed')),
  quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  best_name TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trip_id, itinerary_item_id)
);

-- Enable RLS
ALTER TABLE public.place_verifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for place_verifications
CREATE POLICY "Users can view own place verifications" 
ON public.place_verifications FOR SELECT 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = place_verifications.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can insert own place verifications" 
ON public.place_verifications FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = place_verifications.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can update own place verifications" 
ON public.place_verifications FOR UPDATE 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = place_verifications.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can delete own place verifications" 
ON public.place_verifications FOR DELETE 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = place_verifications.trip_id AND trips.user_id = auth.uid()));

-- Create trip_places table for map pins
CREATE TABLE public.trip_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'you_search',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_places ENABLE ROW LEVEL SECURITY;

-- RLS policies for trip_places
CREATE POLICY "Users can view own trip places" 
ON public.trip_places FOR SELECT 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_places.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can insert own trip places" 
ON public.trip_places FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_places.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can update own trip places" 
ON public.trip_places FOR UPDATE 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_places.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can delete own trip places" 
ON public.trip_places FOR DELETE 
USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_places.trip_id AND trips.user_id = auth.uid()));

-- Add indexes for performance
CREATE INDEX idx_place_verifications_trip_id ON public.place_verifications(trip_id);
CREATE INDEX idx_place_verifications_item_id ON public.place_verifications(itinerary_item_id);
CREATE INDEX idx_trip_places_trip_id ON public.trip_places(trip_id);