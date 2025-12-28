import { useEffect, useState } from 'react';
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
  Loader2, ChevronDown, ChevronUp, Users, IndianRupee,
  Share2, Copy, Link as LinkIcon, Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  Itinerary, Trip, ItineraryItem,
  parseItinerary, groupItemsByTimeBlock, getTimeBlockOrder 
} from '@/lib/itinerary-adapter';
import { calculateBudget, formatCurrency, BudgetSummary } from '@/lib/budget-calculator';

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
      
      // Check if share URL exists
      if (!shareResult.error && shareResult.data && shareResult.data.length > 0) {
        setShareUrl(`${window.location.origin}/share/${shareResult.data[0].token}`);
      }
    }
    if (!itinerariesResult.error && itinerariesResult.data) {
      const parsed = itinerariesResult.data.map(parseItinerary);
      setItineraries(parsed);
      
      // Use selected_itinerary_id if exists, else default to best/first option
      const tripData = tripResult.data as Trip | null;
      if (tripData?.selected_itinerary_id) {
        const selected = parsed.find(it => it.id === tripData.selected_itinerary_id);
        if (selected) setSelectedOption(selected.option_index);
      } else {
        const best = parsed.find(it => it.is_best_option || it.recommended);
        if (best) setSelectedOption(best.option_index);
        else if (parsed.length > 0) setSelectedOption(parsed[0].option_index);
      }
    }
    setLoading(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    
    try {
      await supabase.from('trips').update({ status: 'generating' }).eq('id', id);
      
      const { error } = await supabase.functions.invoke('generate-itinerary', {
        body: { tripId: id }
      });

      if (error) throw error;
      
      toast({ title: 'Regenerating itinerary...', description: 'This may take a minute.' });
      fetchTrip();
    } catch (error) {
      console.error('Regeneration error:', error);
      toast({
        variant: 'destructive',
        title: 'Regeneration failed',
        description: 'Please try again later.'
      });
    } finally {
      setRegenerating(false);
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
      toast({
        variant: 'destructive',
        title: 'Select an itinerary first',
        description: 'You need to select an itinerary before sharing.'
      });
      return;
    }

    setCreatingShare(true);
    try {
      // Generate a random token
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
      setShareUrl(url);
      toast({ title: 'Share link created!' });
    } catch (error) {
      console.error('Share creation error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create share link',
        description: 'Please try again.'
      });
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
  };

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev => ({ ...prev, [dayNumber]: !prev[dayNumber] }));
  };

  // Calculate budget for selected itinerary
  const currentItinerary = itineraries.find(it => it.option_index === selectedOption);
  const budgetSummary = currentItinerary && trip 
    ? calculateBudget(currentItinerary, trip.budget_inr) 
    : null;

  const renderItemCard = (item: ItineraryItem, index: number) => (
    <div 
      key={index} 
      className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
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
      <div className="min-h-screen">
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="container max-w-4xl mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </main>
      </div>
    );
  }

  if (!trip) {
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
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/app')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {trip.destination}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating || trip.status === 'generating'}
          >
            {regenerating || trip.status === 'generating' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6">
        {/* Generating State */}
        {trip.status === 'generating' && (
          <div className="glass-card p-8 text-center mb-6 animate-fade-in">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-display font-semibold mb-2">Creating your perfect itinerary...</h2>
            <p className="text-muted-foreground">
              Our AI is researching {trip.destination} and crafting personalized options for you.
            </p>
          </div>
        )}

        {/* Failed State */}
        {trip.status === 'failed' && (
          <div className="glass-card p-8 text-center mb-6 border-destructive/50">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-display font-semibold mb-2">Generation failed</h2>
            <p className="text-muted-foreground mb-4">
              Something went wrong. Please try regenerating.
            </p>
            <Button onClick={handleRegenerate} disabled={regenerating}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Itineraries */}
        {trip.status === 'completed' && itineraries.length > 0 && (
          <div className="space-y-6">
            {/* Option Tabs + Actions */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {itineraries.map((itinerary) => (
                  <button
                    key={itinerary.id}
                    onClick={() => setSelectedOption(itinerary.option_index)}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      selectedOption === itinerary.option_index
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                    }`}
                  >
                    {(itinerary.is_best_option || itinerary.recommended) && <Star className="w-4 h-4 inline mr-1" />}
                    Option {itinerary.option_label}
                    {trip.selected_itinerary_id === itinerary.id && (
                      <Check className="w-3 h-3 inline ml-1" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/app/trip/${id}/compare`}>
                    Compare All
                  </Link>
                </Button>
              </div>
            </div>

            {/* Share/Export Actions */}
            <div className="flex flex-wrap gap-2">
              {shareUrl ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-secondary text-sm truncate">
                    <LinkIcon className="w-3.5 h-3.5 inline mr-2 text-muted-foreground" />
                    {shareUrl}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
                    {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCreateShareLink}
                  disabled={creatingShare || !trip.selected_itinerary_id}
                >
                  {creatingShare ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-2" />
                  )}
                  {trip.selected_itinerary_id ? 'Create Share Link' : 'Select to Share'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleCopyItinerary}>
                <Copy className="w-4 h-4 mr-2" />
                Copy as Text
              </Button>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'itinerary' | 'budget')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="itinerary">
                  <Calendar className="w-4 h-4 mr-2" />
                  Itinerary
                </TabsTrigger>
                <TabsTrigger value="budget">
                  <Wallet className="w-4 h-4 mr-2" />
                  Budget
                </TabsTrigger>
              </TabsList>

              <TabsContent value="itinerary" className="space-y-6 mt-6">
                {/* Selected Itinerary Detail */}
                {itineraries.filter(it => it.option_index === selectedOption).map((itinerary) => (
                  <div key={itinerary.id} className="space-y-6 animate-fade-in">
                    {/* Header Card */}
                    <div className={`glass-card p-6 ${itinerary.is_best_option || itinerary.recommended ? 'border-accent/50 glow-accent' : ''}`}>
                      {(itinerary.is_best_option || itinerary.recommended) && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-medium mb-4">
                          <Star className="w-4 h-4" />
                          Best for You
                        </div>
                      )}
                      <h2 className="text-2xl font-display font-semibold mb-2">{itinerary.title}</h2>
                      <p className="text-muted-foreground mb-4">{itinerary.summary}</p>
                      
                      {itinerary.why_good_for_you && (
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{itinerary.why_good_for_you}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Days */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium">Day-by-Day Plan</h3>
                      {itinerary.days.map((day) => {
                        const isExpanded = expandedDays[day.day];
                        const itemsByBlock = groupItemsByTimeBlock(day.items);
                        const timeBlocks = ['morning', 'afternoon', 'evening', 'night'] as const;
                        
                        return (
                          <div key={day.day} className="glass-card overflow-hidden">
                            <button
                              onClick={() => toggleDay(day.day)}
                              className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <span className="font-display font-semibold text-primary">{day.day}</span>
                                </div>
                                <div className="text-left">
                                  <span className="font-medium">{day.title}</span>
                                  {day.notes && (
                                    <p className="text-sm text-muted-foreground line-clamp-1">{day.notes}</p>
                                  )}
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            
                            {isExpanded && (
                              <div className="px-4 pb-4 space-y-4 animate-slide-up">
                                {timeBlocks.map((block) => {
                                  const blockItems = itemsByBlock[block] || [];
                                  
                                  return (
                                    <div key={block} className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="capitalize">{block}</span>
                                        <Badge variant="outline" className="text-xs ml-auto">
                                          {blockItems.length} {blockItems.length === 1 ? 'activity' : 'activities'}
                                        </Badge>
                                      </div>
                                      
                                      {blockItems.length > 0 ? (
                                        <div className="space-y-2">
                                          {blockItems
                                            .sort((a, b) => getTimeBlockOrder(a.time_block) - getTimeBlockOrder(b.time_block))
                                            .map((item, idx) => renderItemCard(item, idx))}
                                        </div>
                                      ) : (
                                        <div className="p-3 rounded-lg bg-secondary/50 text-center">
                                          <p className="text-sm text-muted-foreground">No planned activity</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Tips & Disclaimers */}
                    {itinerary.general_tips.length > 0 && (
                      <div className="glass-card p-5">
                        <h3 className="font-medium mb-3 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-primary" />
                          Travel Tips
                        </h3>
                        <ul className="space-y-2">
                          {itinerary.general_tips.map((tip, index) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {itinerary.disclaimers.length > 0 && (
                      <div className="glass-card p-5 border-yellow-500/20 bg-yellow-500/5">
                        <h3 className="font-medium mb-3 flex items-center gap-2 text-yellow-500">
                          <AlertTriangle className="w-4 h-4" />
                          Important Notes
                        </h3>
                        <ul className="space-y-2">
                          {itinerary.disclaimers.map((disclaimer, index) => (
                            <li key={index} className="text-sm text-muted-foreground">
                              {disclaimer}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Select Button */}
                    <Button
                      onClick={() => handleSelectItinerary(itinerary.id)}
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={trip.selected_itinerary_id === itinerary.id}
                    >
                      {trip.selected_itinerary_id === itinerary.id ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Selected as Final
                        </>
                      ) : (
                        'Select This Itinerary'
                      )}
                    </Button>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="budget" className="space-y-6 mt-6">
                {budgetSummary && currentItinerary && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Budget Overview */}
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-lg font-display font-semibold flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-primary" />
                        Budget Summary
                      </h3>
                      
                      {/* Total Estimate */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-secondary">
                          <div className="text-sm text-muted-foreground mb-1">Estimated Range</div>
                          <div className="text-2xl font-display font-semibold">
                            {formatCurrency(budgetSummary.totalMin)} - {formatCurrency(budgetSummary.totalMax)}
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-secondary">
                          <div className="text-sm text-muted-foreground mb-1">Your Budget</div>
                          <div className="text-2xl font-display font-semibold">
                            {formatCurrency(trip.budget_inr)}
                          </div>
                        </div>
                      </div>

                      {/* Budget Status */}
                      {budgetSummary.overBudget ? (
                        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-destructive">Over budget warning</p>
                              <p className="text-sm text-muted-foreground">
                                This itinerary may exceed your budget by approximately {formatCurrency(Math.abs(budgetSummary.budgetDifference))}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-green-500">Within budget</p>
                              <p className="text-sm text-muted-foreground">
                                You have approximately {formatCurrency(budgetSummary.budgetDifference)} buffer
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Category Breakdown */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Utensils className="w-4 h-4 text-orange-400" />
                            Food & Dining
                          </div>
                          <div className="font-medium">
                            {formatCurrency(budgetSummary.foodTotalMin)} - {formatCurrency(budgetSummary.foodTotalMax)}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MapPin className="w-4 h-4 text-blue-400" />
                            Activities
                          </div>
                          <div className="font-medium">
                            {formatCurrency(budgetSummary.activitiesTotalMin)} - {formatCurrency(budgetSummary.activitiesTotalMax)}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-sm text-muted-foreground mb-1">Average Per Day</div>
                        <div className="font-medium">{formatCurrency(budgetSummary.averagePerDay)}</div>
                      </div>
                    </div>

                    {/* Daily Breakdown */}
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-lg font-display font-semibold">Daily Breakdown</h3>
                      
                      <div className="space-y-3">
                        {budgetSummary.dailyBreakdown.map((day) => (
                          <div key={day.day} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary">{day.day}</span>
                              </div>
                              <div>
                                <div className="font-medium">{day.title}</div>
                                <div className="text-xs text-muted-foreground">{day.itemCount} activities</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {formatCurrency(day.costMin)} - {formatCurrency(day.costMax)}
                              </div>
                              {day.foodCostMin > 0 && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                  <Utensils className="w-3 h-3" />
                                  {formatCurrency(day.foodCostMin)}-{formatCurrency(day.foodCostMax)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                      <AlertTriangle className="w-4 h-4 inline mr-2 text-yellow-500" />
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
            <h2 className="text-xl font-display font-semibold mb-2">No itineraries found</h2>
            <p className="text-muted-foreground mb-4">Try regenerating to create new options.</p>
            <Button onClick={handleRegenerate}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Itinerary
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
