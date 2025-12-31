import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Star, RefreshCw, Check, MapPin, 
  Calendar, Clock, Utensils, Lightbulb, AlertTriangle,
  Loader2, Users, IndianRupee,
  Share2, Copy, Link as LinkIcon, Wallet, Map as MapIcon, X, BadgeCheck,
  Gauge, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  Itinerary, Trip, ItineraryItem, ItineraryDay,
  parseItinerary, groupItemsByTimeBlock, getTimeBlockOrder 
} from '@/lib/itinerary-adapter';
import { calculateBudget, formatCurrency, BudgetSummary } from '@/lib/budget-calculator';
import { TimelineDay } from '@/components/trip/TimelineDay';
import { TripMap } from '@/components/trip/TripMap';
import { cn } from '@/lib/utils';

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget'>('itinerary');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [enriching, setEnriching] = useState(false);
  
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [selectedActivityIndex, setSelectedActivityIndex] = useState<number | null>(null);
  const [showMobileMap, setShowMobileMap] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTrip();
      const interval = setInterval(() => {
        if (trip?.status === 'generating') {
          fetchTrip();
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [id, trip?.status]);

  const fetchTrip = async () => {
    const [tripResult, itinerariesResult, shareResult] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('itineraries').select('*').eq('trip_id', id).order('option_index'),
      supabase.from('trip_share_tokens').select('token').eq('trip_id', id).limit(1)
    ]);

    if (!tripResult.error && tripResult.data) {
      const tripData = tripResult.data as Trip;
      setTrip(tripData);
      
      if (!shareResult.error && shareResult.data && shareResult.data.length > 0) {
        setShareUrl(`${window.location.origin}/share/${shareResult.data[0].token}`);
      }
    }
    if (!itinerariesResult.error && itinerariesResult.data) {
      const parsed = itinerariesResult.data.map(parseItinerary);
      setItineraries(parsed);
      
      const tripData = tripResult.data as Trip | null;
      if (tripData?.selected_itinerary_id) {
        const selected = parsed.find(it => it.id === tripData.selected_itinerary_id);
        if (selected) setSelectedOption(selected.option_index);
      } else {
        const best = parsed.find(it => it.is_best_option || it.recommended);
        if (best) setSelectedOption(best.option_index);
        else if (parsed.length > 0) setSelectedOption(parsed[0].option_index);
      }
      
      if (parsed.length > 0 && parsed[0].days.length > 0) {
        setExpandedDays({ [parsed[0].days[0].day]: true });
      }
    }
    setLoading(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await supabase.from('trips').update({ status: 'generating' }).eq('id', id);
      const { error } = await supabase.functions.invoke('generate-itinerary', { body: { tripId: id } });
      if (error) throw error;
      toast({ title: 'Regenerating itinerary...', description: 'This may take a minute.' });
      fetchTrip();
    } catch (error) {
      console.error('Regeneration error:', error);
      toast({ variant: 'destructive', title: 'Regeneration failed', description: 'Please try again later.' });
    } finally {
      setRegenerating(false);
    }
  };

  const handleEnrichFacts = async () => {
    const currentIt = itineraries.find(it => it.option_index === selectedOption);
    if (!currentIt) return;
    setEnriching(true);
    try {
      const { error } = await supabase.functions.invoke('enrich-itinerary', { body: { trip_id: id, option_id: currentIt.id } });
      if (error) throw error;
      toast({ title: 'Facts verified!', description: 'Itinerary enriched with real-world data.' });
      fetchTrip();
    } catch (error) {
      console.error('Enrichment error:', error);
      toast({ variant: 'destructive', title: 'Verification failed', description: 'Could not fetch verified facts. Try again later.' });
    } finally {
      setEnriching(false);
    }
  };

  const handleSelectItinerary = async (itineraryId: string) => {
    const { error } = await supabase.from('trips').update({ selected_itinerary_id: itineraryId }).eq('id', id);
    if (!error) {
      toast({ title: 'Itinerary saved!', description: 'You can always come back and change it.' });
      setTrip(prev => prev ? { ...prev, selected_itinerary_id: itineraryId } : null);
    }
  };

  const handleCreateShareLink = async () => {
    if (!trip || !trip.selected_itinerary_id) {
      toast({ variant: 'destructive', title: 'Select an itinerary first', description: 'You need to select an itinerary before sharing.' });
      return;
    }
    setCreatingShare(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('trip_share_tokens').insert({ trip_id: trip.id, token, created_by: user.id });
      if (error) throw error;
      const url = `${window.location.origin}/share/${token}`;
      setShareUrl(url);
      toast({ title: 'Share link created!' });
    } catch (error) {
      console.error('Share creation error:', error);
      toast({ variant: 'destructive', title: 'Failed to create share link', description: 'Please try again.' });
    } finally {
      setCreatingShare(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopySuccess(true);
    toast({ title: 'Link copied!' });
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleCopyItinerary = () => {
    const currentItinerary = itineraries.find(it => it.option_index === selectedOption);
    if (!currentItinerary || !trip) return;
    let text = `🗺️ ${trip.destination} Trip\n`;
    text += `📅 ${format(new Date(trip.start_date), 'MMM d')} - ${format(new Date(trip.end_date), 'MMM d, yyyy')}\n\n`;
    text += `${currentItinerary.title}\n${currentItinerary.summary}\n\n`;
    currentItinerary.days.forEach(day => {
      text += `--- Day ${day.day}: ${day.title} ---\n`;
      day.items.sort((a, b) => getTimeBlockOrder(a.time_block) - getTimeBlockOrder(b.time_block)).forEach(item => {
        text += `• [${item.time_block}] ${item.title}`;
        if (item.location_area) text += ` @ ${item.location_area}`;
        if (item.cost_min || item.cost_max) text += ` (₹${item.cost_min || 0}-${item.cost_max || 0})`;
        text += '\n';
      });
      text += '\n';
    });
    navigator.clipboard.writeText(text);
    toast({ title: 'Itinerary copied as text!' });
  };

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev => ({ ...prev, [dayNumber]: !prev[dayNumber] }));
  };

  const currentItinerary = itineraries.find(it => it.option_index === selectedOption);
  const budgetSummary = currentItinerary && trip ? calculateBudget(currentItinerary, trip.budget_inr) : null;
  const selectedDay = currentItinerary?.days[selectedDayIndex] || null;

  const getDayStartIndex = useCallback((dayIdx: number): number => {
    if (!currentItinerary) return 0;
    let index = 0;
    for (let i = 0; i < dayIdx; i++) { index += currentItinerary.days[i]?.items.length || 0; }
    return index;
  }, [currentItinerary]);

  const handlePinClick = (globalIndex: number) => {
    setSelectedActivityIndex(globalIndex);
    const activityElement = document.getElementById(`activity-${globalIndex}`);
    if (activityElement) { activityElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };

  const handleActivitySelect = (dayIdx: number) => (globalIndex: number) => { setSelectedActivityIndex(globalIndex); };
  const handleDaySelect = (dayIdx: number) => { setSelectedDayIndex(dayIdx); setSelectedActivityIndex(null); };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-border/30 bg-background/90 backdrop-blur-xl sticky top-0 z-50">
          <div className="container max-w-7xl mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-[500px] rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-display mb-4">Trip not found</h2>
          <Button asChild><Link to="/app">Back to Dashboard</Link></Button>
        </div>
      </div>
    );
  }

  const getStatusChip = () => {
    if (trip.status === 'generating') return { label: 'Generating', color: 'bg-warning/20 text-warning border-warning/30' };
    if (trip.status === 'failed') return { label: 'Failed', color: 'bg-destructive/20 text-destructive border-destructive/30' };
    return { label: 'Ready', color: 'bg-success/20 text-success border-success/30' };
  };
  const statusChip = getStatusChip();

  return (
    <div className="min-h-screen pb-8">
      {/* Premium Sticky Header */}
      <header className="border-b border-border/30 bg-background/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4">
          {/* Main header row */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate('/app')} className="flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-display font-semibold truncate">{trip.destination}</h1>
                  <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full border', statusChip.color)}>
                    {statusChip.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setShowMobileMap(true)} className="lg:hidden">
                <MapIcon className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleEnrichFacts} disabled={enriching || trip.status === 'generating'} className="hidden sm:inline-flex">
                {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BadgeCheck className="w-4 h-4 mr-1.5" />Verify</>}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || trip.status === 'generating'}>
                {regenerating || trip.status === 'generating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1.5" />Regenerate</>}
              </Button>
            </div>
          </div>
          
          {/* Trip summary chips row */}
          <div className="pb-3 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
              <IndianRupee className="w-3 h-3" />₹{trip.budget_inr.toLocaleString()}
            </span>
            {trip.is_family && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                <Users className="w-3 h-3" />Family
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6">
        {/* Generating State */}
        {trip.status === 'generating' && (
          <div className="glass-card p-8 text-center mb-6 animate-fade-in border-warning/30">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-lg font-display font-semibold mb-2">Creating your itinerary...</h2>
            <p className="text-sm text-muted-foreground">Researching {trip.destination} and crafting personalized options.</p>
          </div>
        )}

        {/* Failed State */}
        {trip.status === 'failed' && (
          <div className="glass-card p-8 text-center mb-6 border-destructive/30">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-display font-semibold mb-2">Generation failed</h2>
            <p className="text-sm text-muted-foreground mb-4">Something went wrong. Please try regenerating.</p>
            <Button onClick={handleRegenerate} disabled={regenerating}><RefreshCw className="w-4 h-4 mr-2" />Try Again</Button>
          </div>
        )}

        {/* Completed State with Itineraries */}
        {trip.status === 'completed' && itineraries.length > 0 && (
          <div className="space-y-6">
            {/* Option Selector Row */}
            <div className="flex items-center justify-between gap-4">
              {/* Segmented Control */}
              <div className="inline-flex bg-secondary/50 p-1 rounded-lg border border-border/30">
                {itineraries.map((itinerary) => (
                  <button
                    key={itinerary.id}
                    onClick={() => { setSelectedOption(itinerary.option_index); setSelectedDayIndex(0); setSelectedActivityIndex(null); }}
                    className={cn(
                      'relative px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
                      selectedOption === itinerary.option_index
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {(itinerary.is_best_option || itinerary.recommended) && (
                      <Star className="w-3.5 h-3.5 inline mr-1 text-accent" />
                    )}
                    Option {itinerary.option_label}
                    {trip.selected_itinerary_id === itinerary.id && (
                      <Check className="w-3 h-3 inline ml-1.5 text-success" />
                    )}
                    {selectedOption === itinerary.option_index && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>
              
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <Link to={`/app/trip/${id}/compare`}>
                  <Sparkles className="w-4 h-4 mr-1.5" />Compare All
                </Link>
              </Button>
            </div>

            {/* Share/Export Row */}
            <div className="flex flex-wrap gap-2">
              {shareUrl ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-secondary/50 text-sm truncate border border-border/30">
                    <LinkIcon className="w-3.5 h-3.5 inline mr-2 text-muted-foreground" />{shareUrl}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
                    {copySuccess ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={handleCreateShareLink} disabled={creatingShare || !trip.selected_itinerary_id}>
                  {creatingShare ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                  {trip.selected_itinerary_id ? 'Create Share Link' : 'Select to Share'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleCopyItinerary}>
                <Copy className="w-4 h-4 mr-2" />Copy as Text
              </Button>
            </div>

            {/* Content Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'itinerary' | 'budget')}>
              <TabsList className="bg-secondary/50 border border-border/30 p-1">
                <TabsTrigger value="itinerary" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Calendar className="w-4 h-4 mr-2" />Itinerary
                </TabsTrigger>
                <TabsTrigger value="budget" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  <Wallet className="w-4 h-4 mr-2" />Budget
                </TabsTrigger>
              </TabsList>

              <TabsContent value="itinerary" className="mt-6">
                {itineraries.filter(it => it.option_index === selectedOption).map((itinerary) => (
                  <div key={itinerary.id} className="animate-fade-in">
                    {/* Itinerary Header Card */}
                    <div className={cn('glass-card p-5 mb-6', (itinerary.is_best_option || itinerary.recommended) && 'border-accent/30')}>
                      {(itinerary.is_best_option || itinerary.recommended) && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/15 text-accent text-xs font-medium mb-3">
                          <Star className="w-3.5 h-3.5" />Best for You
                        </div>
                      )}
                      <h2 className="text-xl font-display font-semibold mb-1.5">{itinerary.title}</h2>
                      <p className="text-sm text-muted-foreground mb-3">{itinerary.summary}</p>
                      {itinerary.why_good_for_you && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-muted-foreground">{itinerary.why_good_for_you}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timeline + Map Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* Timeline Section - 60% */}
                      <div className="lg:col-span-3 space-y-4">
                        <h3 className="text-base font-semibold flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />Day-by-Day Timeline
                        </h3>
                        <div className="space-y-3">
                          {itinerary.days.map((day, dayIdx) => (
                            <TimelineDay
                              key={day.day}
                              day={day}
                              isExpanded={expandedDays[day.day] ?? false}
                              isActive={selectedDayIndex === dayIdx}
                              onToggle={() => toggleDay(day.day)}
                              onSelect={() => handleDaySelect(dayIdx)}
                              selectedActivityIndex={selectedActivityIndex}
                              onActivitySelect={handleActivitySelect(dayIdx)}
                              dayStartIndex={getDayStartIndex(dayIdx)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Map Section - 40% Desktop */}
                      <div className="hidden lg:block lg:col-span-2">
                        <div className="sticky top-28">
                          <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
                            <MapIcon className="w-4 h-4 text-primary" />Day {selectedDay?.day || 1} Map
                          </h3>
                          <TripMap
                            day={selectedDay}
                            selectedActivityIndex={selectedActivityIndex}
                            onPinClick={handlePinClick}
                            className="h-[480px]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tips & Disclaimers */}
                    <div className="mt-8 space-y-4">
                      {itinerary.general_tips.length > 0 && (
                        <div className="glass-card p-4">
                          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-primary" />Travel Tips
                          </h3>
                          <ul className="space-y-1.5">
                            {itinerary.general_tips.map((tip, index) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-primary mt-1">•</span>{tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {itinerary.disclaimers.length > 0 && (
                        <div className="glass-card p-4 border-warning/20 bg-warning/5">
                          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-warning">
                            <AlertTriangle className="w-4 h-4" />Important Notes
                          </h3>
                          <ul className="space-y-1.5">
                            {itinerary.disclaimers.map((disclaimer, index) => (
                              <li key={index} className="text-sm text-muted-foreground">{disclaimer}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Select Button */}
                    <Button
                      onClick={() => handleSelectItinerary(itinerary.id)}
                      className="w-full mt-6"
                      disabled={trip.selected_itinerary_id === itinerary.id}
                    >
                      {trip.selected_itinerary_id === itinerary.id ? <><Check className="w-4 h-4 mr-2" />Selected as Final</> : 'Select This Itinerary'}
                    </Button>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="budget" className="space-y-6 mt-6">
                {budgetSummary && currentItinerary && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Budget Overview */}
                    <div className="glass-card p-5 space-y-4">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary" />Budget Summary
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-secondary/50 border border-border/30">
                          <div className="text-xs text-muted-foreground mb-1">Estimated Range</div>
                          <div className="text-xl font-display font-semibold">
                            {formatCurrency(budgetSummary.totalMin)} – {formatCurrency(budgetSummary.totalMax)}
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-secondary/50 border border-border/30">
                          <div className="text-xs text-muted-foreground mb-1">Your Budget</div>
                          <div className="text-xl font-display font-semibold">{formatCurrency(trip.budget_inr)}</div>
                        </div>
                      </div>
                      {budgetSummary.overBudget ? (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-destructive">Over budget warning</p>
                              <p className="text-xs text-muted-foreground">May exceed by ~{formatCurrency(Math.abs(budgetSummary.budgetDifference))}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                          <div className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-success">Within budget</p>
                              <p className="text-xs text-muted-foreground">~{formatCurrency(budgetSummary.budgetDifference)} buffer</p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Utensils className="w-3.5 h-3.5 text-accent" />Food & Dining
                          </div>
                          <div className="text-sm font-medium">{formatCurrency(budgetSummary.foodTotalMin)} – {formatCurrency(budgetSummary.foodTotalMax)}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <MapPin className="w-3.5 h-3.5 text-primary" />Activities
                          </div>
                          <div className="text-sm font-medium">{formatCurrency(budgetSummary.activitiesTotalMin)} – {formatCurrency(budgetSummary.activitiesTotalMax)}</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/20">
                        <div className="text-xs text-muted-foreground mb-1">Average Per Day</div>
                        <div className="text-sm font-medium">{formatCurrency(budgetSummary.averagePerDay)}</div>
                      </div>
                    </div>

                    {/* Daily Breakdown */}
                    <div className="glass-card p-5 space-y-4">
                      <h3 className="text-base font-semibold">Daily Breakdown</h3>
                      <div className="space-y-2">
                        {budgetSummary.dailyBreakdown.map((day) => (
                          <div key={day.day} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-semibold text-primary">{day.day}</span>
                              </div>
                              <div>
                                <div className="text-sm font-medium">{day.title}</div>
                                <div className="text-xs text-muted-foreground">{day.itemCount} activities</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{formatCurrency(day.costMin)} – {formatCurrency(day.costMax)}</div>
                              {day.foodCostMin > 0 && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                  <Utensils className="w-3 h-3" />{formatCurrency(day.foodCostMin)}–{formatCurrency(day.foodCostMax)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/20 border border-border/20 text-xs text-muted-foreground">
                      <AlertTriangle className="w-3.5 h-3.5 inline mr-2 text-warning" />
                      Costs are estimates and may vary based on season, availability, and personal choices.
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Empty State */}
        {trip.status === 'completed' && itineraries.length === 0 && (
          <div className="glass-card p-8 text-center">
            <h2 className="text-lg font-display font-semibold mb-2">No itineraries found</h2>
            <p className="text-sm text-muted-foreground mb-4">Try regenerating to create new options.</p>
            <Button onClick={handleRegenerate}><RefreshCw className="w-4 h-4 mr-2" />Generate Itinerary</Button>
          </div>
        )}
      </main>

      {/* Mobile Map Bottom Sheet */}
      {showMobileMap && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowMobileMap(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border/30 rounded-t-2xl animate-slide-up">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Day {selectedDay?.day || 1} Map</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowMobileMap(false)}><X className="w-5 h-5" /></Button>
              </div>
              <TripMap
                day={selectedDay}
                selectedActivityIndex={selectedActivityIndex}
                onPinClick={(idx) => { handlePinClick(idx); setShowMobileMap(false); }}
                className="h-[400px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}