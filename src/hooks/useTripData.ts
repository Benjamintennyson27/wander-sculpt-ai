import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Itinerary, Trip, VerifiedFacts, parseItinerary 
} from '@/lib/itinerary-adapter';
import { Source } from '@/lib/format-activity';
interface UseTripDataOptions {
  tripId: string;
  pollOnGenerating?: boolean;
  pollInterval?: number;
}

interface UseTripDataReturn {
  trip: Trip | null;
  itineraries: Itinerary[];
  loading: boolean;
  shareUrl: string | null;
  refetch: () => Promise<void>;
}

export function useTripData({ 
  tripId, 
  pollOnGenerating = true, 
  pollInterval = 3000 
}: UseTripDataOptions): UseTripDataReturn {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const fetchTrip = useCallback(async () => {
    if (!tripId) return;

    const [tripResult, itinerariesResult, shareResult, verificationsResult] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('itineraries').select('*').eq('trip_id', tripId).order('option_index'),
      supabase.from('trip_share_tokens').select('token').eq('trip_id', tripId).limit(1),
      supabase.from('place_verifications').select('*').eq('trip_id', tripId)
    ]);

    if (!tripResult.error && tripResult.data) {
      setTrip(tripResult.data as Trip);
      
      if (!shareResult.error && shareResult.data?.length > 0) {
        setShareUrl(`${window.location.origin}/share/${shareResult.data[0].token}`);
      }
    }

    if (!itinerariesResult.error && itinerariesResult.data) {
      // Build verification lookup map
      const verificationsMap = new Map<string, Record<string, unknown>>();
      if (!verificationsResult.error && verificationsResult.data) {
        for (const v of verificationsResult.data) {
          verificationsMap.set(v.itinerary_item_id, v);
        }
      }
      
      // Parse itineraries and merge verification data
      const parsed = itinerariesResult.data.map(raw => {
        const itinerary = parseItinerary(raw);
        // Merge verifications into items
        for (const day of itinerary.days) {
          for (let itemIdx = 0; itemIdx < day.items.length; itemIdx++) {
            const item = day.items[itemIdx];
            const itemId = `${itinerary.id}-d${day.day}-i${itemIdx}`;
            const verification = verificationsMap.get(itemId);
            if (verification) {
              const rawSources = verification.sources as unknown[];
              const sources: Source[] = Array.isArray(rawSources) 
                ? rawSources.filter((s): s is Source => 
                    s !== null && typeof s === 'object' && 'title' in s && 'url' in s && 'snippet' in s
                  )
                : [];
              
              const status = verification.status as string;
              const validStatus: VerifiedFacts['status'] = 
                status === 'verified' || status === 'partial' || status === 'unverified' || status === 'failed'
                  ? status
                  : undefined;
              
              item.verified_facts = {
                verified_note: verification.reasoning as string | undefined,
                hours_text: null,
                price_text: null,
                closed_day_text: null,
                sources,
                status: validStatus,
                quality_score: verification.quality_score as number | undefined,
                best_name: verification.best_name as string | undefined,
                address: verification.address as string | undefined,
                lat: verification.lat as number | undefined,
                lng: verification.lng as number | undefined,
              };
            }
          }
        }
        return itinerary;
      });
      setItineraries(parsed);
    }
    
    setLoading(false);
  }, [tripId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchTrip();
    
    if (!pollOnGenerating) return;
    
    const interval = setInterval(() => {
      if (trip?.status === 'generating') {
        fetchTrip();
      }
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [tripId, trip?.status, fetchTrip, pollOnGenerating, pollInterval]);

  return { trip, itineraries, loading, shareUrl, refetch: fetchTrip };
}
