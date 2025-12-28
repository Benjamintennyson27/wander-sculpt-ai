-- Create trip_share_tokens table for shareable links
CREATE TABLE public.trip_share_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL
);

-- Create index for fast token lookups
CREATE INDEX idx_trip_share_tokens_token ON public.trip_share_tokens(token);
CREATE INDEX idx_trip_share_tokens_trip_id ON public.trip_share_tokens(trip_id);

-- Enable Row Level Security
ALTER TABLE public.trip_share_tokens ENABLE ROW LEVEL SECURITY;

-- Owner can manage their share tokens
CREATE POLICY "Users can view own share tokens"
ON public.trip_share_tokens
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_share_tokens.trip_id AND trips.user_id = auth.uid()
));

CREATE POLICY "Users can create share tokens for own trips"
ON public.trip_share_tokens
FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_share_tokens.trip_id AND trips.user_id = auth.uid()
));

CREATE POLICY "Users can delete own share tokens"
ON public.trip_share_tokens
FOR DELETE
USING (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_share_tokens.trip_id AND trips.user_id = auth.uid()
));

-- Create function for public token access (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_shared_trip(share_token TEXT)
RETURNS TABLE (
    trip_id UUID,
    destination TEXT,
    start_date DATE,
    end_date DATE,
    budget_inr INTEGER,
    is_family BOOLEAN,
    selected_itinerary_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        t.id as trip_id,
        t.destination,
        t.start_date,
        t.end_date,
        t.budget_inr,
        t.is_family,
        t.selected_itinerary_id
    FROM trip_share_tokens tst
    JOIN trips t ON t.id = tst.trip_id
    WHERE tst.token = share_token
    AND (tst.expires_at IS NULL OR tst.expires_at > now())
$$;

-- Create function to get shared itinerary (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_shared_itinerary(share_token TEXT)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    title TEXT,
    option_label TEXT,
    option_index INTEGER,
    summary TEXT,
    pace TEXT,
    total_cost_min INTEGER,
    total_cost_max INTEGER,
    recommended BOOLEAN,
    is_best_option BOOLEAN,
    pros TEXT[],
    cons TEXT[],
    why_good_for_you TEXT,
    general_tips JSONB,
    disclaimers JSONB,
    days JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        i.id,
        i.trip_id,
        i.title,
        i.option_label,
        i.option_index,
        i.summary,
        i.pace,
        i.total_cost_min,
        i.total_cost_max,
        i.recommended,
        i.is_best_option,
        i.pros,
        i.cons,
        i.why_good_for_you,
        i.general_tips,
        i.disclaimers,
        i.days
    FROM trip_share_tokens tst
    JOIN trips t ON t.id = tst.trip_id
    JOIN itineraries i ON i.id = t.selected_itinerary_id
    WHERE tst.token = share_token
    AND (tst.expires_at IS NULL OR tst.expires_at > now())
$$;