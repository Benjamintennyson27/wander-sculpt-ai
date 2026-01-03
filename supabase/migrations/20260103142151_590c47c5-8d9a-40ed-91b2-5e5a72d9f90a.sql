
-- Create trip_chat_threads table
CREATE TABLE public.trip_chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trip_chat_messages table
CREATE TABLE public.trip_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.trip_chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create itinerary_edits_log table
CREATE TABLE public.itinerary_edits_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_edits_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for trip_chat_threads
CREATE POLICY "Users can view their own chat threads"
ON public.trip_chat_threads FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own chat threads"
ON public.trip_chat_threads FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own chat threads"
ON public.trip_chat_threads FOR DELETE
USING (user_id = auth.uid());

-- RLS policies for trip_chat_messages (via thread ownership)
CREATE POLICY "Users can view messages in their threads"
ON public.trip_chat_messages FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.trip_chat_threads t
    WHERE t.id = thread_id AND t.user_id = auth.uid()
));

CREATE POLICY "Users can create messages in their threads"
ON public.trip_chat_messages FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.trip_chat_threads t
    WHERE t.id = thread_id AND t.user_id = auth.uid()
));

-- RLS policies for itinerary_edits_log (via trip ownership)
CREATE POLICY "Users can view edits for their trips"
ON public.itinerary_edits_log FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_id AND t.user_id = auth.uid()
));

CREATE POLICY "Users can create edits for their trips"
ON public.itinerary_edits_log FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_id AND t.user_id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_trip_chat_threads_trip_id ON public.trip_chat_threads(trip_id);
CREATE INDEX idx_trip_chat_threads_user_id ON public.trip_chat_threads(user_id);
CREATE INDEX idx_trip_chat_messages_thread_id ON public.trip_chat_messages(thread_id);
CREATE INDEX idx_itinerary_edits_log_trip_id ON public.itinerary_edits_log(trip_id);
