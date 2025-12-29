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
  morning: {
    accent: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    glow: 'hover:shadow-[0_0_20px_hsla(45,100%,60%,0.15)]',
  },
  afternoon: {
    accent: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    glow: 'hover:shadow-[0_0_20px_hsla(25,100%,60%,0.15)]',
  },
  evening: {
    accent: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    glow: 'hover:shadow-[0_0_20px_hsla(270,100%,60%,0.15)]',
  },
  night: {
    accent: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    glow: 'hover:shadow-[0_0_20px_hsla(210,100%,60%,0.15)]',
  },
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
          'group relative p-4 rounded-xl transition-all duration-300 cursor-pointer',
          'bg-card/50 backdrop-blur-sm border border-border/50',
          colors.glow,
          isSelected && `ring-2 ring-primary/50 ${colors.bg} ${colors.border}`,
          !isSelected && 'hover:bg-card/70 hover:border-border'
        )}
      >
        {/* Glow effect on hover */}
        <div className={cn(
          'absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300',
          'group-hover:opacity-100',
          colors.bg
        )} />
        
        <div className="relative space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h5 className="font-medium text-foreground leading-tight">{item.title}</h5>
                {hasVerifiedData && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                    <BadgeCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              {item.location_area && (
                <p className={cn('text-sm mt-1 flex items-center gap-1.5', colors.accent)}>
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{item.location_area}</span>
                </p>
              )}
            </div>
            
            {/* Cost badge */}
            {((item.cost_min && item.cost_min > 0) || (item.cost_max && item.cost_max > 0)) && (
              <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-secondary/80 text-xs font-medium text-foreground">
                ₹{item.cost_min || 0} - ₹{item.cost_max || 0}
              </div>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
          )}

          {/* Verified Facts Chips */}
          {hasVerifiedData && (
            <div className="flex flex-wrap gap-2">
              {facts.hours_text && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                  <Timer className="w-3 h-3" />
                  {facts.hours_text.length > 40 ? facts.hours_text.slice(0, 37) + '...' : facts.hours_text}
                </span>
              )}
              {facts.price_text && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                  <IndianRupee className="w-3 h-3" />
                  {facts.price_text.length > 40 ? facts.price_text.slice(0, 37) + '...' : facts.price_text}
                </span>
              )}
              {facts.closed_day_text && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <Ban className="w-3 h-3" />
                  {facts.closed_day_text}
                </span>
              )}
            </div>
          )}

          {/* Verified Note */}
          {facts?.verified_note && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-emerald-500/30 pl-3">
              {facts.verified_note}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {item.duration_minutes && item.duration_minutes > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {item.duration_minutes} min
              </span>
            )}
            {item.food_related && (
              <span className="flex items-center gap-1.5 text-orange-400">
                <Utensils className="w-3.5 h-3.5" />
                Food
              </span>
            )}
            {item.kid_friendly && (
              <span className="flex items-center gap-1.5 text-blue-400">
                <Users className="w-3.5 h-3.5" />
                Kid-friendly
              </span>
            )}
            
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'flex items-center gap-1.5 ml-auto',
                  'px-2.5 py-1 rounded-lg',
                  'bg-primary/10 text-primary',
                  'hover:bg-primary/20 transition-colors'
                )}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Maps
              </a>
            )}
          </div>

          {/* Transit tip */}
          {item.transit_tip && (
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400">🚗 {item.transit_tip}</p>
            </div>
          )}

          {/* Assumptions warning */}
          {item.assumptions && (
            <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-400">{item.assumptions}</p>
            </div>
          )}

          {/* Sources Collapsible */}
          {hasSources && (
            <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
              <CollapsibleTrigger 
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {sourcesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {facts.sources!.length} source{facts.sources!.length !== 1 ? 's' : ''}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-1.5 pl-1">
                  {facts.sources!.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-start gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors text-xs"
                    >
                      <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{source.title}</div>
                        <div className="text-muted-foreground line-clamp-2">{source.snippet}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* No verified data message */}
          {!hasVerifiedData && !hasSources && facts === null && (
            <p className="text-xs text-muted-foreground/60 italic">Limited verified information available</p>
          )}
        </div>
      </div>
    );
  }
);
