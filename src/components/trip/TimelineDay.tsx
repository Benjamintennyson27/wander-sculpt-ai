import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { ItineraryDay, ItineraryItem, groupItemsByTimeBlock } from '@/lib/itinerary-adapter';
import { TimelineBlock } from './TimelineBlock';
import { cn } from '@/lib/utils';

interface TimelineDayProps {
  day: ItineraryDay;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  onSelect: () => void;
  selectedActivityIndex?: number | null;
  onActivitySelect?: (globalIndex: number) => void;
  dayStartIndex: number;
}

const timeBlocks = ['morning', 'afternoon', 'evening', 'night'] as const;

export function TimelineDay({
  day,
  isExpanded,
  isActive,
  onToggle,
  onSelect,
  selectedActivityIndex,
  onActivitySelect,
  dayStartIndex,
}: TimelineDayProps) {
  const itemsByBlock = groupItemsByTimeBlock(day.items) as Record<typeof timeBlocks[number], (ItineraryItem & { maps_query?: string })[]>;
  
  let runningIndex = dayStartIndex;
  const blockStartIndices: Record<string, number> = {};
  timeBlocks.forEach(block => {
    blockStartIndices[block] = runningIndex;
    runningIndex += (itemsByBlock[block]?.length || 0);
  });

  // Calculate summary stats
  const totalActivities = day.items.length;
  const totalCostMin = day.items.reduce((sum, item) => sum + (item.cost_min || 0), 0);
  const totalCostMax = day.items.reduce((sum, item) => sum + (item.cost_max || 0), 0);

  return (
    <div 
      id={`day-${day.day}`}
      className={cn(
        'glass-card overflow-hidden transition-all duration-200',
        isActive && 'ring-1 ring-primary/40'
      )}
    >
      {/* Day header */}
      <button
        onClick={() => { onSelect(); onToggle(); }}
        className={cn('w-full p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors')}
      >
        <div className="flex items-center gap-3">
          {/* Day number badge */}
          <div className={cn(
            'relative w-10 h-10 rounded-lg flex items-center justify-center',
            'bg-primary/10 border border-primary/20'
          )}>
            <span className="font-display text-lg font-bold text-primary">{day.day}</span>
          </div>
          
          <div className="text-left">
            <h3 className="font-semibold text-base text-foreground line-clamp-1">{day.title}</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{totalActivities} {totalActivities === 1 ? 'activity' : 'activities'}</span>
              {totalCostMax > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />₹{totalCostMin.toLocaleString()}–{totalCostMax.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center bg-secondary/50')}>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-5 animate-fade-in">
          <div className="pt-2">
            {timeBlocks.map(block => (
              <TimelineBlock
                key={block}
                block={block}
                items={itemsByBlock[block] || []}
                selectedActivityIndex={selectedActivityIndex}
                onActivitySelect={onActivitySelect}
                startIndex={blockStartIndices[block]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}