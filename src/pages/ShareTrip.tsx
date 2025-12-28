import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, Calendar, Clock, Utensils, Users,
  IndianRupee, Lightbulb, AlertTriangle,
  ChevronDown, ChevronUp, Star
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  Itinerary, ItineraryItem, parseItinerary, 
  getTimeBlockOrder, getPaceColor 
} from '@/lib/itinerary-adapter';

interface SharedTrip {
  trip_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget_inr: number;
  is_family: boolean;
  selected_itinerary_id: string;
}

export default function ShareTrip() {
  const { token } = useParams<{ token: string }>();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));

  useEffect(() => {
    if (token) fetchSharedData();
  }, [token]);

  const fetchSharedData = async () => {
    try {
      // Fetch shared trip using RPC function
      const { data: tripData, error: tripError } = await supabase
        .rpc('get_shared_trip', { share_token: token });

      if (tripError || !tripData || tripData.length === 0) {
        setError('This share link is invalid or has expired.');
        setLoading(false);
        return;
      }

      setTrip(tripData[0] as SharedTrip);

      // Fetch shared itinerary using RPC function
      const { data: itinData, error: itinError } = await supabase
        .rpc('get_shared_itinerary', { share_token: token });

      if (itinError || !itinData || itinData.length === 0) {
        setError('No itinerary selected for this trip.');
        setLoading(false);
        return;
      }

      const parsed = parseItinerary(itinData[0]);
      setItinerary(parsed);
    } catch (err) {
      console.error('Error fetching shared data:', err);
      setError('Failed to load shared trip.');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  };

  const renderItemCard = (item: ItineraryItem, index: number) => (
    <div 
      key={index} 
      className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {item.time_block}
          </Badge>
          {item.food_related && (
            <Utensils className="w-3.5 h-3.5 text-orange-400" />
          )}
          {item.kid_friendly && (
            <Users className="w-3.5 h-3.5 text-blue-400" />
          )}
        </div>
        {(item.cost_min && item.cost_min > 0) || (item.cost_max && item.cost_max > 0) ? (
          <span className="text-xs text-muted-foreground">
            ₹{item.cost_min || 0} - ₹{item.cost_max || 0}
          </span>
        ) : null}
      </div>
      
      <h5 className="font-medium">{item.title}</h5>
      
      {item.description && (
        <p className="text-sm text-muted-foreground">{item.description}</p>
      )}
      
      <div className="flex flex-wrap gap-2 text-xs">
        {item.location_area && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-3 h-3" /> {item.location_area}
          </span>
        )}
        {item.duration_minutes && item.duration_minutes > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" /> {item.duration_minutes} min
          </span>
        )}
      </div>

      {item.transit_tip && (
        <p className="text-xs text-blue-400 bg-blue-500/10 p-2 rounded">
          🚗 {item.transit_tip}
        </p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <div className="container max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !trip || !itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center glass-card p-8 max-w-md">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-display font-semibold mb-2">
            {error || 'Trip not found'}
          </h2>
          <p className="text-muted-foreground mb-4">
            The share link may have expired or been deleted.
          </p>
          <Button asChild>
            <Link to="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Calculate budget totals
  const totalCostMin = itinerary.days.reduce((sum, day) => 
    sum + day.items.reduce((daySum, item) => daySum + (item.cost_min || 0), 0), 0);
  const totalCostMax = itinerary.days.reduce((sum, day) => 
    sum + day.items.reduce((daySum, item) => daySum + (item.cost_max || 0), 0), 0);

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <MapPin className="w-3 h-3" />
                Shared Itinerary
              </div>
              <h1 className="text-lg font-display font-semibold">{trip.destination}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/">Plan Your Trip</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Itinerary Header */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-display font-semibold">{itinerary.title}</h2>
                {(itinerary.recommended || itinerary.is_best_option) && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Best Pick
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{itinerary.summary}</p>
            </div>
            <Badge className={getPaceColor(itinerary.pace)}>{itinerary.pace}</Badge>
          </div>

          {itinerary.why_good_for_you && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-primary">{itinerary.why_good_for_you}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <div className="text-2xl font-display font-semibold">{itinerary.days.length}</div>
              <div className="text-xs text-muted-foreground">Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-display font-semibold flex items-center justify-center">
                <IndianRupee className="w-5 h-5" />
                {totalCostMin > 0 ? `${Math.round(totalCostMin / 1000)}k` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Est. Min</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-display font-semibold flex items-center justify-center">
                <IndianRupee className="w-5 h-5" />
                {totalCostMax > 0 ? `${Math.round(totalCostMax / 1000)}k` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Est. Max</div>
            </div>
          </div>
        </div>

        {/* Day-by-Day Plan */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Day-by-Day Plan</h3>
          
          {itinerary.days.map(day => (
            <div key={day.day} className="glass-card overflow-hidden">
              <button
                onClick={() => toggleDay(day.day)}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-semibold">{day.day}</span>
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium">{day.title}</h4>
                    {day.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{day.notes}</p>
                    )}
                  </div>
                </div>
                {expandedDays.has(day.day) ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {expandedDays.has(day.day) && day.items.length > 0 && (
                <div className="px-4 pb-4 space-y-3">
                  {day.items
                    .sort((a, b) => getTimeBlockOrder(a.time_block) - getTimeBlockOrder(b.time_block))
                    .map((item, idx) => renderItemCard(item, idx))}
                </div>
              )}

              {expandedDays.has(day.day) && day.items.length === 0 && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Free day - no planned activities
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tips */}
        {itinerary.general_tips.length > 0 && (
          <div className="glass-card p-4 space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Lightbulb className="w-4 h-4 text-primary" /> Travel Tips
            </h4>
            <ul className="space-y-1">
              {itinerary.general_tips.map((tip, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span> {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="glass-card p-6 text-center">
          <h3 className="font-display font-semibold mb-2">Love this itinerary?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your own personalized travel plan with AI
          </p>
          <Button asChild>
            <Link to="/">Start Planning</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
