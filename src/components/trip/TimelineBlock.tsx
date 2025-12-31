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
    time: '6 AM - 12 PM',
    gradient: 'from-amber-500/20 to-amber-500/5',
    iconColor: 'text-amber-400',
    lineColor: 'bg-amber-500/30',
  },
  afternoon: {
    icon: Sunset,
    label: 'Afternoon',
    time: '12 PM - 5 PM',
    gradient: 'from-orange-500/20 to-orange-500/5',
    iconColor: 'text-orange-400',
    lineColor: 'bg-orange-500/30',
  },
  evening: {
    icon: CloudMoon,
    label: 'Evening',
    time: '5 PM - 9 PM',
    gradient: 'from-purple-500/20 to-purple-500/5',
    iconColor: 'text-purple-400',
    lineColor: 'bg-purple-500/30',
  },
  night: {
    icon: Moon,
    label: 'Night',
    time: '9 PM onwards',
    gradient: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-400',
    lineColor: 'bg-blue-500/30',
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
      <div className={cn(
        'absolute left-3 top-0 bottom-0 w-0.5',
        config.lineColor
      )} />

      {/* Time block header with icon */}
      <div className="relative mb-4">
        {/* Icon node on timeline */}
        <div className={cn(
          'absolute -left-8 top-0 w-6 h-6 rounded-full',
          'flex items-center justify-center',
          'bg-card border-2 border-border',
          config.iconColor
        )}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        
        <div className={cn(
          'py-2 px-3 rounded-lg inline-flex items-center gap-2',
          'bg-gradient-to-r',
          config.gradient
        )}>
          <span className={cn('font-medium text-sm', config.iconColor)}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">{config.time}</span>
        </div>
      </div>

      {/* Activities or empty state */}
      <div className="space-y-3 pb-6">
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
            'py-6 px-4 rounded-xl border border-dashed border-border/50',
            'bg-card/30 text-center'
          )}>
            <p className="text-sm text-muted-foreground">Nothing planned yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
