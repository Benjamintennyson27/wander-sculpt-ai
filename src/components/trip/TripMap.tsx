import { useState, forwardRef } from 'react';
import { ItineraryDay, ItineraryItem } from '@/lib/itinerary-adapter';
import { cn } from '@/lib/utils';
import { MapPin, Navigation } from 'lucide-react';

interface TripMapProps {
  day: ItineraryDay | null;
  selectedActivityIndex: number | null;
  onPinClick: (activityIndex: number) => void;
  className?: string;
}

// Premium teal/gold color palette for pins
const timeBlockPinColors = {
  morning: { bg: '#fbbf24', border: '#f59e0b' },    // amber/gold
  afternoon: { bg: '#fb923c', border: '#f97316' },  // orange
  evening: { bg: '#22d3d8', border: '#14b8a6' },    // teal/cyan
  night: { bg: '#60a5fa', border: '#3b82f6' },      // blue
};

export const TripMap = forwardRef<HTMLDivElement, TripMapProps>(
  function TripMap({ day, selectedActivityIndex, onPinClick, className }, ref) {
    const [hoveredPin, setHoveredPin] = useState<number | null>(null);
    
    const activities: { item: ItineraryItem & { maps_query?: string }; index: number; block: string }[] = [];
    if (day) {
      const timeBlocks = ['morning', 'afternoon', 'evening', 'night'];
      let globalIndex = 0;
      timeBlocks.forEach(block => {
        day.items.filter(item => item.time_block === block).forEach(item => {
          activities.push({ item, index: globalIndex, block });
          globalIndex++;
        });
      });
    }

    const getPinPosition = (index: number, total: number) => {
      const angle = (index / total) * 2 * Math.PI + Math.PI / 4;
      const radius = 25 + (index % 3) * 8;
      return { left: `${50 + radius * Math.cos(angle)}%`, top: `${50 + radius * Math.sin(angle)}%` };
    };

    if (!day || activities.length === 0) {
      return (
        <div ref={ref} className={cn('relative rounded-xl overflow-hidden bg-card/50 backdrop-blur-xl border border-border/30 flex items-center justify-center', className)}>
          <div className="text-center p-8">
            <div className="w-14 h-14 rounded-xl bg-secondary/50 flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Select a day to view locations</p>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('relative rounded-xl overflow-hidden bg-gradient-to-br from-card/70 via-card/50 to-card/30 backdrop-blur-xl border border-border/30', className)}>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-15">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Day label */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-secondary/70 backdrop-blur-sm border border-border/30">
          <Navigation className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Day {day.day}</span>
        </div>

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {activities.slice(0, -1).map((activity, idx) => {
            const pos1 = getPinPosition(idx, activities.length);
            const pos2 = getPinPosition(idx + 1, activities.length);
            return <line key={idx} x1={pos1.left} y1={pos1.top} x2={pos2.left} y2={pos2.top} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />;
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
              className={cn('absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 group z-10', isSelected && 'z-20 scale-110', isHovered && !isSelected && 'scale-105')}
              style={{ left: position.left, top: position.top }}
            >
              <div className={cn('absolute inset-0 rounded-full blur-md transition-opacity', isSelected ? 'opacity-60' : 'opacity-0 group-hover:opacity-30')} style={{ backgroundColor: colors.bg }} />
              <div className="relative w-9 h-9 rounded-full flex items-center justify-center border-2 shadow-lg" style={{ backgroundColor: colors.bg, borderColor: colors.border, boxShadow: isSelected ? `0 0 16px ${colors.bg}60` : '0 2px 6px rgba(0,0,0,0.25)' }}>
                <span className="text-xs font-bold text-background">{idx + 1}</span>
              </div>
              {(isHovered || isSelected) && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 rounded-md bg-popover/95 backdrop-blur-sm border border-border/40 shadow-lg min-w-[130px] max-w-[180px] animate-fade-in z-30">
                  <p className="text-xs font-medium text-foreground truncate">{activity.item.title}</p>
                  {activity.item.location_area && <p className="text-[10px] text-muted-foreground truncate">{activity.item.location_area}</p>}
                </div>
              )}
            </button>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {Object.entries(timeBlockPinColors).map(([block, colors]) => (
              <div key={block} className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/50 backdrop-blur-sm border border-border/20">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.bg }} />
                <span className="text-[10px] text-muted-foreground capitalize">{block}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);