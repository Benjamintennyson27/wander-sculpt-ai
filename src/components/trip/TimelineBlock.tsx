import { Sun, Sunset, Moon, CloudMoon, Plus } from 'lucide-react';
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
    bg: 'bg-amber-500/8',
    iconColor: 'text-amber-500',
    lineColor: 'bg-amber-500/30',
    dotBg: 'bg-amber-500/20',
  },
  afternoon: {
    icon: Sunset,
    label: 'Afternoon',
    time: '12 PM – 5 PM',
    bg: 'bg-orange-500/8',
    iconColor: 'text-orange-500',
    lineColor: 'bg-orange-500/30',
    dotBg: 'bg-orange-500/20',
  },
  evening: {
    icon: CloudMoon,
    label: 'Evening',
    time: '5 PM – 9 PM',
    bg: 'bg-primary/8',
    iconColor: 'text-primary',
    lineColor: 'bg-primary/30',
    dotBg: 'bg-primary/20',
  },
  night: {
    icon: Moon,
    label: 'Night',
    time: '9 PM onwards',
    bg: 'bg-accent/8',
    iconColor: 'text-accent',
    lineColor: 'bg-accent/30',
    dotBg: 'bg-accent/20',
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
        'absolute left-[11px] top-0 bottom-0 w-[2px] rounded-full',
        config.lineColor
      )} />

      {/* Time block header */}
      <div className="relative mb-3">
        {/* Dot on timeline */}
        <div className={cn(
          'absolute -left-8 top-0.5 w-6 h-6 rounded-full',
          'flex items-center justify-center',
          'bg-card border border-border',
          config.dotBg
        )}>
          <Icon className={cn('w-3.5 h-3.5', config.iconColor)} />
        </div>
        
        <div className={cn(
          'inline-flex items-center gap-2 py-1.5 px-3 rounded-md',
          config.bg
        )}>
          <span className={cn('font-medium text-sm', config.iconColor)}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">{config.time}</span>
        </div>
      </div>

      {/* Activities or premium empty state */}
      <div className="space-y-3 pb-5">
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
          <div className="empty-state">
            <p className="text-sm text-muted-foreground mb-2">
              No plans yet for this time block
            </p>
            <p className="text-xs text-muted-foreground/60 flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" />
              Use "Regenerate" to add suggestions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}