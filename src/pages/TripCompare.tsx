import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Star, Clock, MapPin, Utensils, 
  Users, IndianRupee, CheckCircle2, XCircle,
  Lightbulb, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  Itinerary, Trip, ItineraryItem,
  parseItinerary, getTimeBlockOrder, getPaceColor 
} from '@/lib/itinerary-adapter';

export default function TripCompare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('A');
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch trip
    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single();

    if (tripError || !tripData) {
      toast({ variant: 'destructive', title: 'Trip not found' });
      navigate('/app');
      return;
    }

    setTrip(tripData as Trip);

    // Fetch itineraries - data is in days JSONB column
    const { data: itinerariesData, error: itinError } = await supabase
      .from('itineraries')
      .select('*')
      .eq('trip_id', id)
      .order('option_index');

    if (itinError) {
      console.error('Error fetching itineraries:', itinError);
      setLoading(false);
      return;
    }

    const parsed = (itinerariesData || []).map(parseItinerary);
    setItineraries(parsed);
    
    // Set initial tab to recommended option
    const recommended = parsed.find(i => i.recommended || i.is_best_option);
    if (recommended) {
      setSelectedTab(recommended.option_label);
    } else if (parsed.length > 0) {
      setSelectedTab(parsed[0].option_label);
    }

    // Expand first day by default
    if (parsed.length > 0 && parsed[0].days.length > 0) {
      setExpandedDays(new Set([parsed[0].days[0].day]));
    }

    setLoading(false);
  };

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  };

  const handleSelectItinerary = async (itineraryId: string) => {
    if (!trip) return;
    
    setSaving(true);
    const { error } = await supabase
      .from('trips')
      .update({ selected_itinerary_id: itineraryId })
      .eq('id', trip.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to save selection' });
    } else {
      toast({ title: 'Itinerary selected!' });
      setTrip({ ...trip, selected_itinerary_id: itineraryId });
    }
    setSaving(false);
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

      {item.assumptions && (
        <p className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          {item.assumptions}
        </p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <div className="container max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!trip || itineraries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">No itineraries found</h2>
          <p className="text-muted-foreground mb-4">Generate itineraries first</p>
          <Button asChild>
            <Link to="/app">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentItinerary = itineraries.find(i => i.option_label === selectedTab) || itineraries[0];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/app/trip/${id}`}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-display font-semibold">{trip.destination}</h1>
              <p className="text-sm text-muted-foreground">Compare {itineraries.length} options</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6">
        {/* Tabs for options */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full">
            {itineraries.map(itin => (
              <TabsTrigger 
                key={itin.option_label} 
                value={itin.option_label}
                className="relative"
              >
                <span className="flex items-center gap-2">
                  Option {itin.option_label}
                  {(itin.recommended || itin.is_best_option) && (
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {itineraries.map(itin => (
            <TabsContent key={itin.option_label} value={itin.option_label} className="space-y-6">
              {/* Itinerary Header */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-display font-semibold">{itin.title}</h2>
                      {(itin.recommended || itin.is_best_option) && (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500">
                          <Star className="w-3 h-3 mr-1 fill-current" />
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">{itin.summary}</p>
                  </div>
                  <Badge className={getPaceColor(itin.pace)}>{itin.pace}</Badge>
                </div>

                {itin.why_good_for_you && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm text-primary">{itin.why_good_for_you}</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <IndianRupee className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {itin.total_cost_min > 0 
                        ? `₹${itin.total_cost_min.toLocaleString()} - ₹${itin.total_cost_max.toLocaleString()}`
                        : 'Cost varies'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{itin.days.length} days</span>
                  </div>
                </div>

                {/* Pros & Cons */}
                <div className="grid md:grid-cols-2 gap-4">
                  {itin.pros.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Pros
                      </h4>
                      <ul className="space-y-1">
                        {itin.pros.map((pro, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-green-400">•</span> {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {itin.cons.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-red-400 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Cons
                      </h4>
                      <ul className="space-y-1">
                        {itin.cons.map((con, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-red-400">•</span> {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Day-by-Day Breakdown */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Day-by-Day Plan</h3>
                
                {itin.days.map(day => (
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

              {/* Tips & Disclaimers */}
              {(itin.general_tips.length > 0 || itin.disclaimers.length > 0) && (
                <div className="glass-card p-4 space-y-4">
                  {itin.general_tips.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-1">
                        <Lightbulb className="w-4 h-4 text-primary" /> Travel Tips
                      </h4>
                      <ul className="space-y-1">
                        {itin.general_tips.map((tip, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary">•</span> {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {itin.disclaimers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-1 text-yellow-500">
                        <AlertTriangle className="w-4 h-4" /> Important Notes
                      </h4>
                      <ul className="space-y-1">
                        {itin.disclaimers.map((disc, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground">{disc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Select Button */}
              <Button
                onClick={() => handleSelectItinerary(itin.id)}
                className="w-full"
                disabled={saving || trip.selected_itinerary_id === itin.id}
              >
                {trip.selected_itinerary_id === itin.id ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Selected
                  </>
                ) : (
                  'Select This Itinerary'
                )}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
