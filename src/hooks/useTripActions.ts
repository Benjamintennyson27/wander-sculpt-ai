import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trip, Itinerary, getTimeBlockOrder } from '@/lib/itinerary-adapter';
import { format } from 'date-fns';

interface UseTripActionsOptions {
  tripId: string;
  trip: Trip | null;
  currentItinerary: Itinerary | null;
  onRefetch: () => void;
}

export function useTripActions({ tripId, trip, currentItinerary, onRefetch }: UseTripActionsOptions) {
  const { toast } = useToast();
  const [regenerating, setRegenerating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      await supabase.from('trips').update({ status: 'generating' }).eq('id', tripId);
      const { error } = await supabase.functions.invoke('generate-itinerary', {
        body: { tripId }
      });
      if (error) throw error;
      toast({ title: 'Regenerating itinerary...', description: 'This may take a minute.' });
      onRefetch();
    } catch (error) {
      console.error('Regeneration error:', error);
      toast({ variant: 'destructive', title: 'Regeneration failed', description: 'Please try again later.' });
    } finally {
      setRegenerating(false);
    }
  }, [tripId, toast, onRefetch]);

  const handleEnrichFacts = useCallback(async () => {
    setEnriching(true);
    try {
      const { error } = await supabase.functions.invoke('verify-trip-places', {
        body: { tripId }
      });
      if (error) throw error;
      toast({ title: 'Facts verified!', description: 'Places verified with real-world data.' });
      onRefetch();
    } catch (error) {
      console.error('Verification error:', error);
      toast({ variant: 'destructive', title: 'Verification failed', description: 'Could not verify places. Try again later.' });
    } finally {
      setEnriching(false);
    }
  }, [tripId, toast, onRefetch]);

  const handleSelectItinerary = useCallback(async (itineraryId: string) => {
    const { error } = await supabase.from('trips').update({ selected_itinerary_id: itineraryId }).eq('id', tripId);
    if (!error) {
      toast({ title: 'Itinerary saved!', description: 'You can always come back and change it.' });
    }
  }, [tripId, toast]);

  const handleCreateShareLink = useCallback(async (): Promise<string | null> => {
    if (!trip?.selected_itinerary_id) {
      toast({ variant: 'destructive', title: 'Select an itinerary first', description: 'You need to select an itinerary before sharing.' });
      return null;
    }
    setCreatingShare(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase.from('trip_share_tokens').insert({
        trip_id: trip.id,
        token,
        created_by: user.id,
      });
      if (error) throw error;
      
      const url = `${window.location.origin}/share/${token}`;
      toast({ title: 'Share link created!' });
      return url;
    } catch (error) {
      console.error('Share creation error:', error);
      toast({ variant: 'destructive', title: 'Failed to create share link', description: 'Please try again.' });
      return null;
    } finally {
      setCreatingShare(false);
    }
  }, [trip, toast]);

  const handleCopyShareLink = useCallback(async (shareUrl: string) => {
    await navigator.clipboard.writeText(shareUrl);
    setCopySuccess(true);
    toast({ title: 'Link copied!' });
    setTimeout(() => setCopySuccess(false), 2000);
  }, [toast]);

  const handleCopyItinerary = useCallback(() => {
    if (!currentItinerary || !trip) return;

    let text = `🗺️ ${trip.destination} Trip\n`;
    text += `📅 ${format(new Date(trip.start_date), 'MMM d')} - ${format(new Date(trip.end_date), 'MMM d, yyyy')}\n\n`;
    text += `${currentItinerary.title}\n`;
    text += `${currentItinerary.summary}\n\n`;

    currentItinerary.days.forEach(day => {
      text += `--- Day ${day.day}: ${day.title} ---\n`;
      day.items
        .sort((a, b) => getTimeBlockOrder(a.time_block) - getTimeBlockOrder(b.time_block))
        .forEach(item => {
          text += `• [${item.time_block}] ${item.title}`;
          if (item.location_area) text += ` @ ${item.location_area}`;
          if (item.cost_min || item.cost_max) text += ` (₹${item.cost_min || 0}-${item.cost_max || 0})`;
          text += '\n';
        });
      text += '\n';
    });

    navigator.clipboard.writeText(text);
    toast({ title: 'Itinerary copied as text!' });
  }, [currentItinerary, trip, toast]);

  return {
    regenerating,
    enriching,
    creatingShare,
    copySuccess,
    handleRegenerate,
    handleEnrichFacts,
    handleSelectItinerary,
    handleCreateShareLink,
    handleCopyShareLink,
    handleCopyItinerary,
  };
}
