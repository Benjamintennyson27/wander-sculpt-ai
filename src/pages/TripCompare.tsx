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

interface ItineraryItem {
  id: string;
  time_block: string;
  title: string;
  description: string;
  location_area: string;
  duration_minutes: number;
  cost_min: number;
  cost_max: number;
  kid_friendly: boolean;
  food_related: boolean;
  transit_tip: string;
  assumptions: string;
}

interface ItineraryDay {
  id: string;
  day_number: number;
  title: string;
  notes: string;
  items: ItineraryItem[];
}

interface Itinerary {
  id: string;
  option_label: string;
  option_index: number;
  title: string;
  summary: string;
  why_good_for_you: string;
  pace: string;
  total_cost_min: number;
  total_cost_max: number;
  recommended: boolean;
  pros: string[];
  cons: string[];
  score: number;
  general_tips: string[];
  disclaimers: string[];
  days_data: ItineraryDay[];
}

interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget_inr: number;
  is_family: boolean;
  status: string;
  selected_itinerary_id: string | null;
}

export default function TripCompare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('A');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
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

    // Fetch itineraries with days and items
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

    const enrichedItineraries: Itinerary[] = [];

    for (const itin of itinerariesData || []) {
      // Fetch days for this itinerary
      const { data: daysData } = await supabase
        .from('itinerary_days')
        .select('*')
        .eq('itinerary_id', itin.id)
        .order('day_number');

      const daysWithItems: ItineraryDay[] = [];

      for (const day of daysData || []) {
        // Fetch items for this day
        const { data: itemsData } = await supabase
          .from('itinerary_items')
          .select('*')
          .eq('itinerary_day_id', day.id);

        daysWithItems.push({
          ...day,
          items: (itemsData || []) as ItineraryItem[],
        });
      }

      enrichedItineraries.push({
        id: itin.id,
        option_label: itin.option_label || String.fromCharCode(64 + itin.option_index),
        option_index: itin.option_index,
        title: itin.title,
        summary: itin.summary || '',
        why_good_for_you: itin.why_good_for_you || '',
        pace: itin.pace || 'moderate',
        total_cost_min: itin.total_cost_min || 0,
        total_cost_max: itin.total_cost_max || 0,
        recommended: itin.recommended || itin.is_best_option || false,
        pros: (itin.pros as string[]) || [],
        cons: (itin.cons as string[]) || [],
        score: itin.score || 0,
        general_tips: (itin.general_tips as string[]) || [],
        disclaimers: (itin.disclaimers as string[]) || [],
        days_data: daysWithItems,
      });
    }

    setItineraries(enrichedItineraries);
    
    // Set initial tab to recommended option
    const recommended = enrichedItineraries.find(i => i.recommended);
    if (recommended) {
      setSelectedTab(recommended.option_label);
    } else if (enrichedItineraries.length > 0) {
      setSelectedTab(enrichedItineraries[0].option_label);
    }

    // Expand first day by default
    if (enrichedItineraries.length > 0 && enrichedItineraries[0].days_data.length > 0) {
      setExpandedDays(new Set([enrichedItineraries[0].days_data[0].id]));
    }

    setLoading(false);
  };

  const toggleDay = (dayId: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
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

  const getTimeBlockOrder = (block: string) => {
    const order: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, night: 3 };
    return order[block] ?? 4;
  };

  const getPaceColor = (pace: string) => {
    switch (pace) {
      case 'relaxed': return 'bg-green-500/20 text-green-400';
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400';
      case 'packed': return 'bg-red-500/20 text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

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
              <Link to="/app">
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
                  {itin.recommended && (
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
                      {itin.recommended && (
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
                    <span>{itin.days_data.length} days</span>
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
                
                {itin.days_data.map(day => (
                  <div key={day.id} className="glass-card overflow-hidden">
                    <button
                      onClick={() => toggleDay(day.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold">{day.day_number}</span>
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium">{day.title}</h4>
                          {day.notes && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{day.notes}</p>
                          )}
                        </div>
                      </div>
                      {expandedDays.has(day.id) ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>

                    {expandedDays.has(day.id) && day.items.length > 0 && (
                      <div className="px-4 pb-4 space-y-3">
                        {day.items
                          .sort((a, b) => getTimeBlockOrder(a.time_block) - getTimeBlockOrder(b.time_block))
                          .map(item => (
                            <div 
                              key={item.id} 
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
                                {(item.cost_min > 0 || item.cost_max > 0) && (
                                  <span className="text-xs text-muted-foreground">
                                    ₹{item.cost_min} - ₹{item.cost_max}
                                  </span>
                                )}
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
                                {item.duration_minutes && (
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
                          ))}
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
                        <Lightbulb className="w-4 h-4 text-yellow-400" /> Tips
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {itin.general_tips.map((tip, idx) => (
                          <li key={idx}>• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {itin.disclaimers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-orange-400" /> Disclaimers
                      </h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {itin.disclaimers.map((d, idx) => (
                          <li key={idx}>• {d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50">
        <div className="container max-w-4xl mx-auto">
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => handleSelectItinerary(currentItinerary.id)}
            disabled={saving || trip.selected_itinerary_id === currentItinerary.id}
          >
            {trip.selected_itinerary_id === currentItinerary.id 
              ? '✓ Selected' 
              : `Select Option ${currentItinerary.option_label}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
