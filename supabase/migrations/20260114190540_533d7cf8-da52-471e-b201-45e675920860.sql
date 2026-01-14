-- Table for trip collaborators
CREATE TABLE public.trip_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.trip_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner can manage collaborators
CREATE POLICY "Trip owners can manage collaborators"
ON public.trip_collaborators
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = trip_collaborators.trip_id
    AND trips.user_id = auth.uid()
  )
);

-- Collaborators can view their own invitations
CREATE POLICY "Users can view invitations sent to them"
ON public.trip_collaborators
FOR SELECT
USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Collaborators can update their own invitation status
CREATE POLICY "Users can accept/decline their invitations"
ON public.trip_collaborators
FOR UPDATE
USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Update trips RLS to allow collaborators to view
DROP POLICY IF EXISTS "Users can view own trips" ON public.trips;
CREATE POLICY "Users can view own trips or collaborated trips"
ON public.trips
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_collaborators.trip_id = trips.id
    AND trip_collaborators.user_id = auth.uid()
    AND trip_collaborators.status = 'accepted'
  )
);

-- Update itineraries RLS to allow collaborators to view
DROP POLICY IF EXISTS "Users can view itineraries for own trips" ON public.itineraries;
CREATE POLICY "Users can view itineraries for own or collaborated trips"
ON public.itineraries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = itineraries.trip_id
    AND (
      trips.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.trip_collaborators
        WHERE trip_collaborators.trip_id = trips.id
        AND trip_collaborators.user_id = auth.uid()
        AND trip_collaborators.status = 'accepted'
      )
    )
  )
);

-- Allow editors to update itineraries
DROP POLICY IF EXISTS "Users can update itineraries for own trips" ON public.itineraries;
CREATE POLICY "Users can update itineraries for own or collaborated trips"
ON public.itineraries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.trips
    WHERE trips.id = itineraries.trip_id
    AND (
      trips.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.trip_collaborators
        WHERE trip_collaborators.trip_id = trips.id
        AND trip_collaborators.user_id = auth.uid()
        AND trip_collaborators.status = 'accepted'
        AND trip_collaborators.role IN ('editor', 'admin')
      )
    )
  )
);

-- Table for trip reminders
CREATE TABLE public.trip_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'before_trip' CHECK (reminder_type IN ('before_trip', 'packing', 'custom')),
  days_before INTEGER NOT NULL DEFAULT 1,
  email TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for reminders
ALTER TABLE public.trip_reminders ENABLE ROW LEVEL SECURITY;

-- Users can manage their own reminders
CREATE POLICY "Users can manage their own reminders"
ON public.trip_reminders
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_trip_collaborators_trip_id ON public.trip_collaborators(trip_id);
CREATE INDEX idx_trip_collaborators_user_id ON public.trip_collaborators(user_id);
CREATE INDEX idx_trip_collaborators_email ON public.trip_collaborators(email);
CREATE INDEX idx_trip_reminders_scheduled ON public.trip_reminders(scheduled_for) WHERE sent_at IS NULL;
