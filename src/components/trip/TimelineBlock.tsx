import { Sun, Sunset, Moon, CloudMoon } from 'lucide-react';
import { ItineraryItem } from '@/lib/itinerary-adapter';
import { ActivityCard } from './ActivityCard';
import { cn } from '@/lib/utils';

interface TimelineBlockProps {
  block: 'morning' | 'afternoon' | 'evening' | 'night';
  items: (ItineraryItem & { maps_query?: string })[];
  selectedActivityIndex?: number | null;
  onActivitySelect?: (globalIndex: number) => void;
  startIndex: number;
}

const blockConfig = {
  morning: {
    icon: Sun,
    label: 'Morning',
    time: '6 AM – 12 PM',
    gradient: 'from-amber-500/15 to-transparent',
    iconColor: 'text-amber-400',
    lineColor: 'bg-amber-500/40',
    dotColor: 'bg-amber-400',
  },
  afternoon: {
    icon: Sunset,
    label: 'Afternoon',
    time: '12 PM – 5 PM',
    gradient: 'from-orange-500/15 to-transparent',
    iconColor: 'text-orange-400',
    lineColor: 'bg-orange-500/40',
    dotColor: 'bg-orange-400',
  },
  evening: {
    icon: CloudMoon,
    label: 'Evening',
    time: '5 PM – 9 PM',
    gradient: 'from-cyan-500/15 to-transparent',
    iconColor: 'text-cyan-400',
    lineColor: 'bg-cyan-500/40',
    dotColor: 'bg-cyan-400',
  },
  night: {
    icon: Moon,
    label: 'Night',
    time: '9 PM onwards',
    gradient: 'from-blue-500/15 to-transparent',
    iconColor: 'text-blue-400',
    lineColor: 'bg-blue-500/40',
    dotColor: 'bg-blue-400',
  },
};

export function TimelineBlock({
  block,
  items,
  selectedActivityIndex,
  onActivitySelect,
  startIndex,
}: TimelineBlockProps) {
  const config = blockConfig[block];
  const Icon = config.icon;

  return (
    <div className="relative pl-8">
      {/* Vertical timeline line */}
      <div className={cn('absolute left-3 top-0 bottom-0 w-px', config.lineColor)} />

      {/* Time block header with icon */}
      <div className="relative mb-3">
        {/* Icon node on timeline */}
        <div className={cn(
          'absolute -left-8 top-0 w-6 h-6 rounded-full',
          'flex items-center justify-center',
          'bg-card border border-border/50',
          config.iconColor
        )}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        
        <div className={cn('py-1.5 px-3 rounded-md inline-flex items-center gap-2 bg-gradient-to-r', config.gradient)}>
          <span className={cn('font-medium text-sm', config.iconColor)}>{config.label}</span>
          <span className="text-xs text-muted-foreground">{config.time}</span>
        </div>
      </div>

      {/* Activities or empty state */}
      <div className="space-y-2.5 pb-5">
        {items.length > 0 ? (
          items.map((item, idx) => {
            const globalIndex = startIndex + idx;
            return (
              <ActivityCard
                key={globalIndex}
                item={item}
                index={globalIndex}
                timeBlock={block}
                isSelected={selectedActivityIndex === globalIndex}
                onSelect={() => onActivitySelect?.(globalIndex)}
              />
            );
          })
        ) : (
          <div className={cn(
            'py-4 px-4 rounded-lg border border-dashed border-border/40',
            'bg-card/20 text-center'
          )}>
            <p className="text-xs text-muted-foreground">Nothing planned yet</p>
          </div>
        )}
      </div>
    </div>
  );
}