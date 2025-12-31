import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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

  return (
    <div 
      id={`day-${day.day}`}
      className={cn(
        'glass-card overflow-hidden transition-all duration-300',
        isActive && 'ring-2 ring-primary/50 glow-primary'
      )}
    >
      {/* Day header */}
      <button
        onClick={() => {
          onSelect();
          onToggle();
        }}
        className={cn(
          'w-full p-4 flex items-center justify-between',
          'hover:bg-secondary/30 transition-colors'
        )}
      >
        <div className="flex items-center gap-4">
          {/* Day number badge */}
          <div className={cn(
            'relative w-12 h-12 rounded-xl flex items-center justify-center',
            'bg-gradient-to-br from-primary/20 to-primary/5',
            'border border-primary/30'
          )}>
            <span className="font-display text-xl font-bold text-primary">{day.day}</span>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-xl bg-primary/10 blur-lg opacity-50" />
          </div>
          
          <div className="text-left">
            <h3 className="font-display font-semibold text-lg text-foreground">
              {day.title}
            </h3>
            {day.notes && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                {day.notes}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {day.items.length} {day.items.length === 1 ? 'activity' : 'activities'}
            </p>
          </div>
        </div>
        
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          'bg-secondary/50 transition-colors',
          'group-hover:bg-secondary'
        )}>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-6 animate-fade-in">
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
