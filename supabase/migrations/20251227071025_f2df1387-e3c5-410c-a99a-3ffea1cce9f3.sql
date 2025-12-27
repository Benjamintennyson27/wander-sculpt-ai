-- Create trip_answers table for Q&A flow
CREATE TABLE public.trip_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL,
  question_key TEXT NOT NULL,
  answer_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_answers ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only manage answers for their own trips
CREATE POLICY "Users can view answers for own trips"
  ON public.trip_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_answers.trip_id AND trips.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert answers for own trips"
  ON public.trip_answers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_answers.trip_id AND trips.user_id = auth.uid()
  ));

CREATE POLICY "Users can update answers for own trips"
  ON public.trip_answers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_answers.trip_id AND trips.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete answers for own trips"
  ON public.trip_answers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_answers.trip_id AND trips.user_id = auth.uid()
  ));

-- Add missing columns to trips table
ALTER TABLE public.trips 
  ADD COLUMN IF NOT EXISTS travel_style TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS people_count INTEGER,
  ADD COLUMN IF NOT EXISTS adults_count INTEGER,
  ADD COLUMN IF NOT EXISTS kids_count INTEGER;

-- Add missing columns to itineraries table
ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS pros TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cons TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Add accepted column to terms_acceptance if not exists
ALTER TABLE public.terms_acceptance
  ADD COLUMN IF NOT EXISTS accepted BOOLEAN DEFAULT true;