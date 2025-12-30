import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Calendar, ExternalLink, CheckCircle2, CircleDashed, Circle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Itinerary, Trip, ItineraryDay, parseItinerary } from '@/lib/itinerary-adapter';
import { cn } from '@/lib/utils';

interface PlaceVerification {
  id: string;
  itinerary_item_id: string;
  status: 'verified' | 'partial' | 'unverified' | 'failed';
  quality_score: number;
  best_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  sources: { title: string; url: string; snippet: string }[];
  reasoning: string | null;
}

const statusConfig = {
  verified: {
    icon: CheckCircle2,
    className: 'bg-emerald-500 text-white',
    ringClassName: 'ring-emerald-500',
  },
  partial: {
    icon: CircleDashed,
    className: 'bg-yellow-500 text-white',
    ringClassName: 'ring-yellow-500',
  },
  unverified: {
    icon: Circle,
    className: 'bg-muted-foreground text-white',
    ringClassName: 'ring-muted-foreground',
  },
  failed: {
    icon: AlertTriangle,
    className: 'bg-destructive text-white',
    ringClassName: 'ring-destructive',
  },
};

export default function TripMapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [verifications, setVerifications] = useState<PlaceVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const [tripResult, itinerariesResult, verificationsResult] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('itineraries').select('*').eq('trip_id', id),
      supabase.from('place_verifications').select('*').eq('trip_id', id),
    ]);

    if (tripResult.data) {
      setTrip(tripResult.data as Trip);
    }

    if (itinerariesResult.data && itinerariesResult.data.length > 0) {
      // Get selected or first itinerary
      const tripData = tripResult.data as Trip | null;
      const parsed = itinerariesResult.data.map(parseItinerary);
      const selected = tripData?.selected_itinerary_id
        ? parsed.find(it => it.id === tripData.selected_itinerary_id)
        : parsed[0];
      setItinerary(selected || parsed[0]);
    }

    if (verificationsResult.data) {
      setVerifications(verificationsResult.data.map(v => ({
        ...v,
        sources: (v.sources || []) as { title: string; url: string; snippet: string }[],
        status: v.status as PlaceVerification['status'],
      })));
    }

    setLoading(false);
  };

  // Get verifications with coordinates for map pins
  const mapPins = verifications.filter(v => v.lat !== null && v.lng !== null);

  // Build verification lookup
  const verificationMap = new Map(verifications.map(v => [v.itinerary_item_id, v]));

  // Calculate map center from pins
  const mapCenter = mapPins.length > 0
    ? {
        lat: mapPins.reduce((sum, p) => sum + (p.lat || 0), 0) / mapPins.length,
        lng: mapPins.reduce((sum, p) => sum + (p.lng || 0), 0) / mapPins.length,
      }
    : { lat: 0, lng: 0 };

  const selectedDay = itinerary?.days[selectedDayIndex];

  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="container max-w-7xl mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[600px] rounded-xl lg:col-span-2" />
            <Skeleton className="h-[600px] rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!trip || !itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-display mb-4">Trip not found</h2>
          <Button asChild>
            <Link to="/app">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/app/trip/${id}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {trip.destination} - Map View
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2 h-[600px] rounded-xl overflow-hidden border border-border bg-card">
            {mapPins.length > 0 ? (
              <iframe
                className="w-full h-full"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&center=${mapCenter.lat},${mapCenter.lng}&zoom=12&maptype=roadmap`}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                  <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display font-semibold mb-2">No verified locations yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Verify places to see them on the map with accurate coordinates.
                  </p>
                  <Button asChild variant="outline">
                    <Link to={`/app/trip/${id}`}>
                      Go to Trip Details
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Day Timeline Panel */}
          <div className="space-y-4 h-[600px] overflow-y-auto">
            {/* Day tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {itinerary.days.map((day, idx) => (
                <button
                  key={day.day}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={cn(
                    'flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    selectedDayIndex === idx
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                  )}
                >
                  Day {day.day}
                </button>
              ))}
            </div>

            {/* Items list */}
            <div className="space-y-3">
            {selectedDay?.items.map((item, itemIdx) => {
                const itemKey = `${selectedDay.day}-${itemIdx}`;
                const verification = verificationMap.get(itemKey);
                const hasCoords = verification?.lat && verification?.lng;
                const config = verification ? statusConfig[verification.status] : null;
                const Icon = config?.icon || Circle;

                return (
                  <div
                    key={itemKey}
                    onClick={() => setSelectedItemId(itemKey === selectedItemId ? null : itemKey)}
                    className={cn(
                      'p-3 rounded-lg border border-border bg-card/50 cursor-pointer transition-all',
                      'hover:border-primary/50',
                      selectedItemId === itemKey && 'ring-2 ring-primary/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status icon */}
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        config?.className || 'bg-muted'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {verification?.best_name || item.title}
                        </h4>
                        
                        {verification && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              Score: {verification.quality_score}
                            </span>
                            {hasCoords && (
                              <a
                                href={`https://www.google.com/maps?q=${verification.lat},${verification.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open Map
                              </a>
                            )}
                          </div>
                        )}

                        {!verification && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Not verified yet
                          </p>
                        )}

                        {verification && !hasCoords && (
                          <p className="text-xs text-yellow-500 mt-1">
                            Missing coordinates
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {selectedItemId === itemKey && verification && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {verification.address && (
                          <p className="text-xs text-muted-foreground">
                            📍 {verification.address}
                          </p>
                        )}
                        {verification.reasoning && (
                          <p className="text-xs text-muted-foreground italic">
                            {verification.reasoning}
                          </p>
                        )}
                        {verification.sources && verification.sources.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium">Sources:</p>
                            {verification.sources.slice(0, 3).map((source, idx) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-1 text-xs text-primary hover:underline"
                              >
                                <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span className="truncate">{source.title}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {selectedDay?.items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No activities for this day
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
