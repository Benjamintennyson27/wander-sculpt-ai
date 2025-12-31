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
  
  // Calculate start indices for each block
  let runningIndex = dayStartIndex;
  const blockStartIndices: Record<string, number> = {};
  timeBlocks.forEach(block => {
    blockStartIndices[block] = runningIndex;
    runningIndex += (itemsByBlock[block]?.length || 0);
  });

  // Count total activities
  const totalActivities = day.items.length;

  return (
    <div 
      id={`day-${day.day}`}
      className={cn(
        'glass-card overflow-hidden transition-all duration-200',
        isActive && 'ring-1 ring-primary/40 glow-primary'
      )}
    >
      {/* Day header - compact and clean */}
      <button
        onClick={() => {
          onSelect();
          onToggle();
        }}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between',
          'hover:bg-secondary/20 transition-colors'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Day number */}
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            'bg-primary/10 border border-primary/20',
            isActive && 'bg-primary/20 border-primary/30'
          )}>
            <span className="font-display text-lg text-primary">{day.day}</span>
          </div>
          
          <div className="text-left">
            <h3 className="font-display text-base text-foreground">
              {day.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {totalActivities} {totalActivities === 1 ? 'activity' : 'activities'}
              </span>
              {day.notes && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[150px]">{day.notes}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center',
          'bg-secondary/50 transition-colors',
          'hover:bg-secondary'
        )}>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-5 pt-2 animate-fade-in border-t border-border/30">
          <div className="pt-3">
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