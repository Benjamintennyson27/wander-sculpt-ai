import { useState, forwardRef } from 'react';
import { 
  MapPin, Clock, Utensils, Users, AlertTriangle, ExternalLink, 
  BadgeCheck, ChevronDown, ChevronUp, Timer, Ban, IndianRupee,
  Landmark, UtensilsCrossed, Car, Hotel
} from 'lucide-react';
import { ItineraryItem } from '@/lib/itinerary-adapter';
import { 
  formatActivityDetails, 
  formatDuration, 
  formatCostRange, 
  parseSources,
  Source 
} from '@/lib/format-activity';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ============================================
// Types
// ============================================

interface ActivityCardProps {
  item: ItineraryItem & { maps_query?: string };
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
  timeBlock: 'morning' | 'afternoon' | 'evening' | 'night';
}

interface ActivityType {
  icon: typeof Landmark;
  label: string;
  colorClass: string;
}

// ============================================
// Constants
// ============================================

const TIME_BLOCK_STYLES = {
  morning: { ring: 'ring-amber-500/30', bg: 'bg-amber-500/8', border: 'border-amber-500/15' },
  afternoon: { ring: 'ring-orange-500/30', bg: 'bg-orange-500/8', border: 'border-orange-500/15' },
  evening: { ring: 'ring-primary/30', bg: 'bg-primary/8', border: 'border-primary/15' },
  night: { ring: 'ring-accent/30', bg: 'bg-accent/8', border: 'border-accent/15' },
} as const;

// ============================================
// Helper Functions
// ============================================

function detectActivityType(item: ItineraryItem): ActivityType {
  const title = item.title.toLowerCase();
  
  if (item.food_related) {
    return { icon: UtensilsCrossed, label: 'Food', colorClass: 'text-orange-400 bg-orange-500/10' };
  }
  if (item.transit_tip || /transit|travel|drive|cab|taxi|bus|train|metro/i.test(title)) {
    return { icon: Car, label: 'Transit', colorClass: 'text-accent bg-accent/10' };
  }
  if (/hotel|stay|accommodation|resort|hostel|airbnb/i.test(title)) {
    return { icon: Hotel, label: 'Hotel', colorClass: 'text-primary bg-primary/10' };
  }
  return { icon: Landmark, label: 'Attraction', colorClass: 'text-primary bg-primary/10' };
}

function buildMapsUrl(query?: string): string | null {
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// ============================================
// Sub-components
// ============================================

function TypeBadge({ type }: { type: ActivityType }) {
  const Icon = type.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium', type.colorClass)}>
      <Icon className="w-3 h-3" />
      {type.label}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-verified/15 text-verified">
      <BadgeCheck className="w-3 h-3" />
      Verified
    </span>
  );
}

function InfoChip({ icon: Icon, children, warning }: { icon: typeof Timer; children: React.ReactNode; warning?: boolean }) {
  return (
    <span className={cn('info-chip', warning && 'text-warning')}>
      <Icon className="w-3 h-3" />
      {children}
    </span>
  );
}

function SourcesList({ sources, open, onOpenChange }: { sources: Source[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (sources.length === 0) {
    return <span className="text-xs text-muted-foreground/50">No sources</span>;
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger 
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Sources ({sources.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="space-y-1.5">
          {sources.map((source, idx) => (
            <a
              key={idx}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-start gap-2 p-2 rounded-md bg-secondary/50 hover:bg-secondary/70 transition-colors text-xs"
            >
              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">{source.title}</div>
                {source.snippet && (
                  <div className="text-muted-foreground line-clamp-2">{source.snippet}</div>
                )}
              </div>
            </a>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// Main Component
// ============================================

export const ActivityCard = forwardRef<HTMLDivElement, ActivityCardProps>(
  function ActivityCard({ item, index, isSelected, onSelect, timeBlock }, ref) {
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const [notesExpanded, setNotesExpanded] = useState(false);
    
    const styles = TIME_BLOCK_STYLES[timeBlock];
    const activityType = detectActivityType(item);
    const mapsUrl = buildMapsUrl(item.maps_query);
    const facts = item.verified_facts;
    
    // Format verified facts
    const formatted = facts ? formatActivityDetails({
      hours: facts.hours_text,
      closedDay: facts.closed_day_text,
      price: facts.price_text,
      notes: facts.verified_note,
    }) : null;
    
    const hasVerifiedData = formatted && (formatted.hours || formatted.price || formatted.closedDay || formatted.notes);
    const sources = parseSources(facts?.sources);
    const costDisplay = formatCostRange(item.cost_min, item.cost_max);
    const durationDisplay = formatDuration(item.duration_minutes);

    return (
      <div
        ref={ref}
        id={`activity-${index}`}
        onClick={onSelect}
        className={cn(
          'group relative rounded-lg transition-all duration-200 cursor-pointer',
          'bg-card/60 backdrop-blur-sm border border-border/50',
          'hover:bg-card/80 hover:border-border/70',
          isSelected && `ring-1 ${styles.ring} ${styles.bg} ${styles.border}`
        )}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <h5 className="font-display text-[15px] text-foreground leading-snug">
                {item.title}
              </h5>
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={activityType} />
                {hasVerifiedData && <VerifiedBadge />}
              </div>
            </div>
            {costDisplay && (
              <div className="flex-shrink-0 px-2.5 py-1 rounded-md bg-secondary/70 text-xs font-medium text-foreground">
                {costDisplay}
              </div>
            )}
          </div>

          {/* Location + Duration */}
          {(item.location_area || durationDisplay) && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {item.location_area && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span className="truncate max-w-[200px]">{item.location_area}</span>
                </span>
              )}
              {durationDisplay && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                  {durationDisplay}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Verified Info Chips */}
          {hasVerifiedData && (
            <div className="flex flex-wrap gap-2">
              {formatted.hours && <InfoChip icon={Timer}>{formatted.hours}</InfoChip>}
              {formatted.price && <InfoChip icon={IndianRupee}>{formatted.price}</InfoChip>}
              {formatted.closedDay && <InfoChip icon={Ban} warning>Closed: {formatted.closedDay}</InfoChip>}
            </div>
          )}

          {/* Verified Note */}
          {formatted?.notes && (
            <div className="text-sm text-muted-foreground border-l-2 border-verified/30 pl-3">
              {formatted.notes.length > 100 && !notesExpanded ? (
                <>
                  {formatted.notes.slice(0, 100)}…
                  <button 
                    onClick={(e) => { e.stopPropagation(); setNotesExpanded(true); }}
                    className="ml-1 text-primary hover:underline"
                  >
                    More
                  </button>
                </>
              ) : formatted.notes}
            </div>
          )}

          {/* Meta Tags */}
          {(item.food_related || item.kid_friendly) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {item.food_related && (
                <span className="flex items-center gap-1.5">
                  <Utensils className="w-3 h-3 text-orange-400" />
                  Food included
                </span>
              )}
              {item.kid_friendly && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-accent" />
                  Kid-friendly
                </span>
              )}
            </div>
          )}

          {/* Transit Tip */}
          {item.transit_tip && (
            <div className="p-2.5 rounded-md bg-accent/8 border border-accent/15">
              <p className="text-xs text-accent">🚗 {item.transit_tip}</p>
            </div>
          )}

          {/* Assumptions Warning */}
          {item.assumptions && (
            <div className="p-2.5 rounded-md bg-warning/8 border border-warning/15 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-warning">{item.assumptions}</p>
            </div>
          )}

          {/* Actions Row */}
          <div className="flex items-center justify-between pt-1">
            <SourcesList sources={sources} open={sourcesOpen} onOpenChange={setSourcesOpen} />
            
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
                  'bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
                )}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Maps
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }
);
