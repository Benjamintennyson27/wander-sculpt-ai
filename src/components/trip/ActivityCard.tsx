import { MapPin, Clock, Utensils, Users, AlertTriangle, ExternalLink } from 'lucide-react';
import { ItineraryItem } from '@/lib/itinerary-adapter';
import { cn } from '@/lib/utils';

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

export function ActivityCard({ item, index, isSelected, onSelect, timeBlock }: ActivityCardProps) {
  const colors = timeBlockColors[timeBlock];
  
  const mapsUrl = item.maps_query 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.maps_query)}`
    : null;

  return (
    <div
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
            <h5 className="font-medium text-foreground leading-tight">{item.title}</h5>
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
      </div>
    </div>
  );
}
