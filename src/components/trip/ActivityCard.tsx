import { useState, forwardRef } from 'react';
import { MapPin, Clock, Utensils, Users, AlertTriangle, ExternalLink, BadgeCheck, ChevronDown, ChevronUp, Timer, Ban, IndianRupee } from 'lucide-react';
import { ItineraryItem } from '@/lib/itinerary-adapter';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ActivityCardProps {
  item: ItineraryItem & { maps_query?: string };
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
  timeBlock: 'morning' | 'afternoon' | 'evening' | 'night';
}

const timeBlockColors = {
  morning: { accent: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
  afternoon: { accent: 'text-orange-400', bg: 'bg-orange-500/8', border: 'border-orange-500/20' },
  evening: { accent: 'text-cyan-400', bg: 'bg-cyan-500/8', border: 'border-cyan-500/20' },
  night: { accent: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-blue-500/20' },
};

export const ActivityCard = forwardRef<HTMLDivElement, ActivityCardProps>(
  function ActivityCard({ item, index, isSelected, onSelect, timeBlock }, ref) {
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const colors = timeBlockColors[timeBlock];
    
    const mapsUrl = item.maps_query 
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.maps_query)}`
      : null;

    const facts = item.verified_facts;
    const hasVerifiedData = facts && (facts.verified_note || facts.hours_text || facts.price_text || facts.closed_day_text);
    const hasSources = facts?.sources && facts.sources.length > 0;

    return (
      <div
        ref={ref}
        id={`activity-${index}`}
        onClick={onSelect}
        className={cn(
          'group relative p-3.5 rounded-lg transition-all duration-200 cursor-pointer',
          'bg-card/40 backdrop-blur-sm border border-border/30',
          'hover:bg-card/60 hover:border-border/50',
          isSelected && `ring-1 ring-primary/50 ${colors.bg} ${colors.border}`
        )}
      >
        <div className="space-y-2.5">
          {/* Header: Title + Cost */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h5 className="font-medium text-sm text-foreground leading-tight">{item.title}</h5>
                {hasVerifiedData && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/15 text-success text-[10px] font-medium">
                    <BadgeCheck className="w-2.5 h-2.5" />Verified
                  </span>
                )}
              </div>
            </div>
            {((item.cost_min && item.cost_min > 0) || (item.cost_max && item.cost_max > 0)) && (
              <div className="flex-shrink-0 px-2 py-0.5 rounded bg-secondary/60 text-xs font-medium text-foreground">
                ₹{item.cost_min || 0}–{item.cost_max || 0}
              </div>
            )}
          </div>

          {/* Location + Duration + Category chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {item.location_area && (
              <span className={cn('flex items-center gap-1', colors.accent)}>
                <MapPin className="w-3 h-3" />{item.location_area}
              </span>
            )}
            {item.duration_minutes && item.duration_minutes > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />{item.duration_minutes}min
              </span>
            )}
            {item.food_related && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px]">
                <Utensils className="w-2.5 h-2.5" />Food
              </span>
            )}
            {item.kid_friendly && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-info/10 text-info text-[10px]">
                <Users className="w-2.5 h-2.5" />Kid-friendly
              </span>
            )}
          </div>

          {/* Description (truncated) */}
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
          )}

          {/* Verified Facts Chips */}
          {hasVerifiedData && (
            <div className="flex flex-wrap gap-1.5">
              {facts.hours_text && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-info/10 border border-info/20 text-[10px] text-info">
                  <Timer className="w-2.5 h-2.5" />{facts.hours_text.length > 30 ? facts.hours_text.slice(0, 27) + '...' : facts.hours_text}
                </span>
              )}
              {facts.price_text && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success/10 border border-success/20 text-[10px] text-success">
                  <IndianRupee className="w-2.5 h-2.5" />{facts.price_text.length > 30 ? facts.price_text.slice(0, 27) + '...' : facts.price_text}
                </span>
              )}
              {facts.closed_day_text && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-destructive/10 border border-destructive/20 text-[10px] text-destructive">
                  <Ban className="w-2.5 h-2.5" />{facts.closed_day_text}
                </span>
              )}
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />Maps
                </a>
              )}
            </div>
            
            {/* Sources collapsible trigger */}
            {hasSources && (
              <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
                <CollapsibleTrigger 
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {sourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Sources ({facts.sources!.length})
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </div>

          {/* Sources expanded */}
          {hasSources && sourcesOpen && (
            <div className="space-y-1.5 pt-1">
              {facts.sources!.map((source, idx) => (
                <a
                  key={idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-start gap-2 p-2 rounded bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs"
                >
                  <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{source.title}</div>
                    <div className="text-muted-foreground line-clamp-1">{source.snippet}</div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Transit tip */}
          {item.transit_tip && (
            <div className="p-2 rounded bg-info/8 border border-info/15">
              <p className="text-[10px] text-info">🚗 {item.transit_tip}</p>
            </div>
          )}

          {/* Assumptions warning */}
          {item.assumptions && (
            <div className="p-2 rounded bg-warning/8 border border-warning/15 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-warning">{item.assumptions}</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);