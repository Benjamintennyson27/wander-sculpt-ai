import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  X, ArrowLeftRight, MapPin, Clock, IndianRupee, 
  Loader2, CheckCircle, AlertTriangle, Users, Utensils
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ItineraryItem } from '@/lib/itinerary-adapter';

interface Alternative {
  title: string;
  area: string;
  description: string;
  estimated_cost_min: number;
  estimated_cost_max: number;
  duration_minutes: number;
  category: string;
  location_text: string;
  maps_query: string;
  kid_friendly: boolean;
  food_related: boolean;
}

interface ReplaceActivityModalProps {
  tripId: string;
  currentItem: ItineraryItem;
  dayNumber: number;
  itemIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSwapComplete: () => void;
}

export function ReplaceActivityModal({
  tripId,
  currentItem,
  dayNumber,
  itemIndex,
  isOpen,
  onClose,
  onSwapComplete,
}: ReplaceActivityModalProps) {
  const { toast } = useToast();
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Fetch alternatives when modal opens
  const fetchAlternatives = async () => {
    if (fetched || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('activity-alternatives', {
        body: { trip_id: tripId, day_number: dayNumber, item_index: itemIndex }
      });

      if (fnError) throw fnError;
      
      if (data?.alternatives) {
        setAlternatives(data.alternatives);
        setFetched(true);
      } else {
        throw new Error('No alternatives returned');
      }
    } catch (err) {
      console.error('Failed to fetch alternatives:', err);
      setError('Could not find alternatives. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on modal open
  useState(() => {
    if (isOpen && !fetched) {
      fetchAlternatives();
    }
  });

  const handleSwap = async (alternative: Alternative, index: number) => {
    setSwapping(index);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('activity-swap', {
        body: {
          trip_id: tripId,
          day_number: dayNumber,
          item_index: itemIndex,
          new_item: alternative,
          auto_verify: false,
        }
      });

      if (fnError) throw fnError;

      toast({
        title: 'Activity swapped!',
        description: `Replaced with "${alternative.title}"`,
      });
      
      onSwapComplete();
      onClose();
    } catch (err) {
      console.error('Swap failed:', err);
      toast({
        variant: 'destructive',
        title: 'Swap failed',
        description: 'Could not replace activity. Try again.',
      });
    } finally {
      setSwapping(null);
    }
  };

  // Re-fetch when opened
  if (isOpen && !fetched && !loading) {
    fetchAlternatives();
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={cn(
        'fixed z-50 bg-card border border-border rounded-xl shadow-2xl',
        'inset-x-4 top-[10%] max-h-[80vh] overflow-hidden',
        'sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg',
        'flex flex-col animate-fade-in'
      )}>
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Replace Activity</h3>
              <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                {currentItem.title}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 rounded-lg border border-border">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={() => { setFetched(false); fetchAlternatives(); }}>
                Try Again
              </Button>
            </div>
          ) : alternatives.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No alternatives found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alternatives.map((alt, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-4 rounded-lg border border-border bg-card/50',
                    'hover:border-primary/50 hover:bg-card/80 transition-all',
                    swapping === idx && 'ring-2 ring-primary/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">{alt.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {alt.description}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {alt.area}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alt.duration_minutes}m
                        </span>
                        <span className="flex items-center gap-1">
                          <IndianRupee className="w-3 h-3" />
                          {alt.estimated_cost_min}-{alt.estimated_cost_max}
                        </span>
                      </div>

                      {/* Tags */}
                      <div className="flex gap-1.5 mt-2">
                        {alt.kid_friendly && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-accent/10 text-accent">
                            <Users className="w-2.5 h-2.5" />
                            Kid-friendly
                          </span>
                        )}
                        {alt.food_related && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-400">
                            <Utensils className="w-2.5 h-2.5" />
                            Food
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSwap(alt, idx)}
                      disabled={swapping !== null}
                      className="flex-shrink-0"
                    >
                      {swapping === idx ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Swap
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Same time slot ({currentItem.time_block}) • Day {dayNumber}
          </p>
        </div>
      </div>
    </>
  );
}
