import { useRef, useState, forwardRef } from 'react';
import { ItineraryDay, ItineraryItem } from '@/lib/itinerary-adapter';
import { cn } from '@/lib/utils';
import { MapPin, Navigation } from 'lucide-react';

interface TripMapProps {
  day: ItineraryDay | null;
  selectedActivityIndex: number | null;
  onPinClick: (activityIndex: number) => void;
  className?: string;
}

// Colors for time blocks
const timeBlockPinColors = {
  morning: { bg: '#fbbf24', border: '#f59e0b' },    // amber
  afternoon: { bg: '#fb923c', border: '#f97316' },  // orange
  evening: { bg: '#a78bfa', border: '#8b5cf6' },    // purple
  night: { bg: '#60a5fa', border: '#3b82f6' },      // blue
};

export const TripMap = forwardRef<HTMLDivElement, TripMapProps>(
  function TripMap({ day, selectedActivityIndex, onPinClick, className }, ref) {
    const mapRef = useRef<HTMLDivElement>(null);
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
    // Create a spiral-like pattern
    const angle = (index / total) * 2 * Math.PI + Math.PI / 4;
    const radius = 25 + (index % 3) * 8;
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
            'relative rounded-2xl overflow-hidden',
            'bg-card/50 backdrop-blur-xl border border-border/50',
            'flex items-center justify-center',
            className
          )}
        >
          <div className="text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Select a day to view locations</p>
          </div>
        </div>
      );
    }

    return (
      <div 
        ref={ref}
        className={cn(
          'relative rounded-2xl overflow-hidden',
          'bg-gradient-to-br from-card/80 via-card/60 to-card/40',
          'backdrop-blur-xl border border-border/50',
          className
        )}
      >
      {/* Map background pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/80 backdrop-blur-sm">
        <Navigation className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Day {day.day}</span>
      </div>

      {/* Connection lines between pins */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {activities.slice(0, -1).map((activity, idx) => {
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
              strokeDasharray="4 4"
              opacity="0.5"
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
              'transition-all duration-300 ease-out',
              'group z-10',
              isSelected && 'z-20 scale-125',
              isHovered && !isSelected && 'scale-110'
            )}
            style={{
              left: position.left,
              top: position.top,
            }}
          >
            {/* Pin shadow */}
            <div 
              className={cn(
                'absolute inset-0 rounded-full blur-md transition-opacity',
                isSelected ? 'opacity-80' : 'opacity-0 group-hover:opacity-40'
              )}
              style={{ backgroundColor: colors.bg }}
            />
            
            {/* Pin marker */}
            <div 
              className={cn(
                'relative w-10 h-10 rounded-full',
                'flex items-center justify-center',
                'border-2 shadow-lg',
                'transition-all duration-300'
              )}
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
                boxShadow: isSelected 
                  ? `0 0 20px ${colors.bg}80, 0 4px 12px rgba(0,0,0,0.3)`
                  : '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <span className="text-sm font-bold text-background">
                {idx + 1}
              </span>
            </div>

            {/* Tooltip */}
            {(isHovered || isSelected) && (
              <div className={cn(
                'absolute top-full left-1/2 -translate-x-1/2 mt-2',
                'px-3 py-2 rounded-lg',
                'bg-popover/95 backdrop-blur-sm border border-border',
                'shadow-xl min-w-[150px] max-w-[200px]',
                'animate-fade-in z-30'
              )}>
                <p className="text-sm font-medium text-foreground truncate">
                  {activity.item.title}
                </p>
                {activity.item.location_area && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {activity.item.location_area}
                  </p>
                )}
              </div>
            )}
          </button>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {Object.entries(timeBlockPinColors).map(([block, colors]) => (
            <div 
              key={block}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/60 backdrop-blur-sm"
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors.bg }}
              />
              <span className="text-xs text-muted-foreground capitalize">{block}</span>
            </div>
          ))}
          </div>
        </div>
      </div>
    );
  }
);
