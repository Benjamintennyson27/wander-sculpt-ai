import { useState, forwardRef } from 'react';
import { ItineraryDay, ItineraryItem } from '@/lib/itinerary-adapter';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

interface TripMapProps {
  day: ItineraryDay | null;
  selectedActivityIndex: number | null;
  onPinClick: (activityIndex: number) => void;
  className?: string;
}

// Premium time block pin colors
const timeBlockPinColors = {
  morning: { bg: '#d97706', border: '#b45309' },    // amber-600
  afternoon: { bg: '#ea580c', border: '#c2410c' },  // orange-600
  evening: { bg: '#0891b2', border: '#0e7490' },    // primary teal
  night: { bg: '#2563eb', border: '#1d4ed8' },      // blue-600 (accent)
};

export const TripMap = forwardRef<HTMLDivElement, TripMapProps>(
  function TripMap({ day, selectedActivityIndex, onPinClick, className }, ref) {
    const [hoveredPin, setHoveredPin] = useState<number | null>(null);
    
    // Flatten activities with their indices
    const activities: { item: ItineraryItem & { maps_query?: string }; index: number; block: string }[] = [];
    if (day) {
      const timeBlocks = ['morning', 'afternoon', 'evening', 'night'];
      let globalIndex = 0;
      
      timeBlocks.forEach(block => {
        day.items
          .filter(item => item.time_block === block)
          .forEach(item => {
            activities.push({ item, index: globalIndex, block });
            globalIndex++;
          });
      });
    }

    // Position pins in a visually pleasing layout
    const getPinPosition = (index: number, total: number) => {
      const angle = (index / total) * 2 * Math.PI + Math.PI / 4;
      const radius = 22 + (index % 3) * 7;
      const centerX = 50;
      const centerY = 50;
      
      return {
        left: `${centerX + radius * Math.cos(angle)}%`,
        top: `${centerY + radius * Math.sin(angle)}%`,
      };
    };

    if (!day || activities.length === 0) {
      return (
        <div 
          ref={ref}
          className={cn(
            'relative rounded-xl overflow-hidden',
            'bg-card/60 backdrop-blur-sm border border-border/50',
            'flex items-center justify-center',
            className
          )}
        >
          <div className="text-center p-8">
            <div className="w-14 h-14 rounded-xl bg-secondary/50 flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Select a day to view locations</p>
          </div>
        </div>
      );
    }

    const selectedActivity = activities.find(a => a.index === selectedActivityIndex);

    return (
      <div 
        ref={ref}
        className={cn(
          'relative rounded-xl overflow-hidden',
          'bg-card/70 backdrop-blur-sm border border-border/50',
          className
        )}
      >
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="mapGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mapGrid)" />
          </svg>
        </div>

        {/* Day label */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-sm border border-border/50">
          <Navigation className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Day {day.day}</span>
        </div>

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {activities.slice(0, -1).map((_, idx) => {
            const pos1 = getPinPosition(idx, activities.length);
            const pos2 = getPinPosition(idx + 1, activities.length);
            return (
              <line
                key={idx}
                x1={pos1.left}
                y1={pos1.top}
                x2={pos2.left}
                y2={pos2.top}
                stroke="hsl(var(--border))"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.4"
              />
            );
          })}
        </svg>

        {/* Pins */}
        {activities.map((activity, idx) => {
          const position = getPinPosition(idx, activities.length);
          const colors = timeBlockPinColors[activity.block as keyof typeof timeBlockPinColors] || timeBlockPinColors.morning;
          const isSelected = selectedActivityIndex === activity.index;
          const isHovered = hoveredPin === activity.index;

          return (
            <button
              key={activity.index}
              onClick={() => onPinClick(activity.index)}
              onMouseEnter={() => setHoveredPin(activity.index)}
              onMouseLeave={() => setHoveredPin(null)}
              className={cn(
                'absolute transform -translate-x-1/2 -translate-y-1/2',
                'transition-all duration-200 ease-out',
                'group z-10',
                isSelected && 'z-20 scale-110',
                isHovered && !isSelected && 'scale-105'
              )}
              style={{
                left: position.left,
                top: position.top,
              }}
            >
              {/* Pin glow */}
              {isSelected && (
                <div 
                  className="absolute inset-0 rounded-full blur-md opacity-50"
                  style={{ backgroundColor: colors.bg }}
                />
              )}
              
              {/* Pin marker */}
              <div 
                className={cn(
                  'relative w-8 h-8 rounded-full',
                  'flex items-center justify-center',
                  'border-2 shadow-md',
                  'transition-all duration-200'
                )}
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                }}
              >
                <span className="text-xs font-bold text-white">
                  {idx + 1}
                </span>
              </div>

              {/* Tooltip on hover */}
              {(isHovered || isSelected) && (
                <div className={cn(
                  'absolute top-full left-1/2 -translate-x-1/2 mt-2',
                  'px-3 py-2 rounded-md',
                  'bg-popover/95 backdrop-blur-sm border border-border',
                  'shadow-lg min-w-[140px] max-w-[180px]',
                  'animate-fade-in z-30'
                )}>
                  <p className="text-xs font-medium text-foreground truncate">
                    {activity.item.title}
                  </p>
                  {activity.item.location_area && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {activity.item.location_area}
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {/* Selected pin detail bottom sheet */}
        {selectedActivity && (
          <div className="absolute bottom-3 left-3 right-3 p-3 rounded-lg bg-popover/95 backdrop-blur-sm border border-border animate-fade-in">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground truncate">
                  {selectedActivity.item.title}
                </p>
                {selectedActivity.item.location_area && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedActivity.item.location_area}
                  </p>
                )}
              </div>
              {selectedActivity.item.maps_query && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedActivity.item.maps_query)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-primary" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap justify-center gap-2" style={{ bottom: selectedActivity ? '70px' : '12px' }}>
          {Object.entries(timeBlockPinColors).map(([block, colors]) => (
            <div 
              key={block}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-card/80 backdrop-blur-sm"
            >
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colors.bg }}
              />
              <span className="text-[10px] text-muted-foreground capitalize">{block}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);