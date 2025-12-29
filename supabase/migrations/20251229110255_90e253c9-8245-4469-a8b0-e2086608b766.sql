-- Create table for storing verified facts from You.com search
CREATE TABLE public.itinerary_item_facts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_item_id UUID NOT NULL,
  verified_note TEXT,
  hours_text TEXT,
  price_text TEXT,
  closed_day_text TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_itinerary_item_facts_item_id ON public.itinerary_item_facts(itinerary_item_id);

-- Enable Row Level Security
ALTER TABLE public.itinerary_item_facts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view facts for their own itinerary items
-- This requires joining through itinerary_items -> itinerary_days -> itineraries -> trips
CREATE POLICY "Users can view facts for own itinerary items" 
ON public.itinerary_item_facts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM itinerary_items ii
    JOIN itinerary_days id ON id.id = ii.itinerary_day_id
    JOIN itineraries i ON i.id = id.itinerary_id
    JOIN trips t ON t.id = i.trip_id
    WHERE ii.id = itinerary_item_facts.itinerary_item_id 
    AND t.user_id = auth.uid()
  )
);

-- RLS Policy: Users can insert facts for their own itinerary items
CREATE POLICY "Users can insert facts for own itinerary items" 
ON public.itinerary_item_facts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM itinerary_items ii
    JOIN itinerary_days id ON id.id = ii.itinerary_day_id
    JOIN itineraries i ON i.id = id.itinerary_id
    JOIN trips t ON t.id = i.trip_id
    WHERE ii.id = itinerary_item_facts.itinerary_item_id 
    AND t.user_id = auth.uid()
  )
);

-- RLS Policy: Users can delete facts for their own itinerary items
CREATE POLICY "Users can delete facts for own itinerary items" 
ON public.itinerary_item_facts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM itinerary_items ii
    JOIN itinerary_days id ON id.id = ii.itinerary_day_id
    JOIN itineraries i ON i.id = id.itinerary_id
    JOIN trips t ON t.id = i.trip_id
    WHERE ii.id = itinerary_item_facts.itinerary_item_id 
    AND t.user_id = auth.uid()
  )
);

-- Create table for caching You.com search results (24 hour cache)
CREATE TABLE public.you_search_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  query TEXT NOT NULL,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Create index for cache lookups
CREATE INDEX idx_you_search_cache_hash ON public.you_search_cache(query_hash);
CREATE INDEX idx_you_search_cache_expires ON public.you_search_cache(expires_at);

-- Enable RLS (service role only - no direct user access)
ALTER TABLE public.you_search_cache ENABLE ROW LEVEL SECURITY;

-- Create table for rate limiting You.com searches per user
CREATE TABLE public.you_search_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  search_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.you_search_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limits
CREATE POLICY "Users can view own search rate limits" 
ON public.you_search_rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own rate limits
CREATE POLICY "Users can insert own search rate limits" 
ON public.you_search_rate_limits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own rate limits
CREATE POLICY "Users can update own search rate limits" 
ON public.you_search_rate_limits 
FOR UPDATE 
USING (auth.uid() = user_id);