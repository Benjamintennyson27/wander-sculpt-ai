-- Add new columns to itineraries table
ALTER TABLE itineraries 
  ADD COLUMN IF NOT EXISTS option_label TEXT DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS recommended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_cost_min INTEGER,
  ADD COLUMN IF NOT EXISTS total_cost_max INTEGER,
  ADD COLUMN IF NOT EXISTS pace TEXT DEFAULT 'moderate';

-- Create itinerary_days table
CREATE TABLE IF NOT EXISTS itinerary_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view itinerary_days for own trips" ON itinerary_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM itineraries i
      JOIN trips t ON t.id = i.trip_id
      WHERE i.id = itinerary_days.itinerary_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert itinerary_days for own trips" ON itinerary_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM itineraries i
      JOIN trips t ON t.id = i.trip_id
      WHERE i.id = itinerary_days.itinerary_id AND t.user_id = auth.uid()
    )
  );

-- Create itinerary_items table
CREATE TABLE IF NOT EXISTS itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_day_id UUID NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  time_block TEXT NOT NULL CHECK (time_block IN ('morning', 'afternoon', 'evening', 'night')),
  title TEXT NOT NULL,
  description TEXT,
  location_area TEXT,
  duration_minutes INTEGER,
  cost_min INTEGER,
  cost_max INTEGER,
  kid_friendly BOOLEAN DEFAULT false,
  food_related BOOLEAN DEFAULT false,
  transit_tip TEXT,
  assumptions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view itinerary_items for own trips" ON itinerary_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM itinerary_days d
      JOIN itineraries i ON i.id = d.itinerary_id
      JOIN trips t ON t.id = i.trip_id
      WHERE d.id = itinerary_items.itinerary_day_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert itinerary_items for own trips" ON itinerary_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM itinerary_days d
      JOIN itineraries i ON i.id = d.itinerary_id
      JOIN trips t ON t.id = i.trip_id
      WHERE d.id = itinerary_items.itinerary_day_id AND t.user_id = auth.uid()
    )
  );