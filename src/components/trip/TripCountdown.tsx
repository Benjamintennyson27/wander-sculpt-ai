import { differenceInDays, isPast, isToday, isTomorrow } from 'date-fns';
import { Clock, Plane, CheckCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripCountdownProps {
  startDate: string;
  endDate: string;
  className?: string;
}

export function TripCountdown({ startDate, endDate, className }: TripCountdownProps) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  
  // Check if trip is ongoing
  const isOngoing = today >= start && today <= end;
  
  // Check if trip is completed
  const isCompleted = isPast(end);
  
  // Days until trip starts
  const daysUntilStart = differenceInDays(start, today);
  
  // Days remaining in trip (if ongoing)
  const daysRemaining = differenceInDays(end, today);
  
  if (isCompleted) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-muted-foreground text-xs',
        className
      )}>
        <CheckCircle className="w-3 h-3" />
        <span>Completed</span>
      </div>
    );
  }
  
  if (isOngoing) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent/20 text-accent text-xs font-medium animate-pulse',
        className
      )}>
        <Plane className="w-3 h-3" />
        <span>
          {daysRemaining === 0 ? 'Last day!' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`}
        </span>
      </div>
    );
  }
  
  if (isToday(start)) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium animate-pulse',
        className
      )}>
        <Plane className="w-3 h-3" />
        <span>Starts today!</span>
      </div>
    );
  }
  
  if (isTomorrow(start)) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium',
        className
      )}>
        <Clock className="w-3 h-3" />
        <span>Tomorrow!</span>
      </div>
    );
  }
  
  if (daysUntilStart <= 7) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium',
        className
      )}>
        <Clock className="w-3 h-3" />
        <span>{daysUntilStart} days away</span>
      </div>
    );
  }
  
  if (daysUntilStart <= 30) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary text-muted-foreground text-xs',
        className
      )}>
        <Calendar className="w-3 h-3" />
        <span>{daysUntilStart} days away</span>
      </div>
    );
  }
  
  // More than 30 days
  const weeks = Math.floor(daysUntilStart / 7);
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary text-muted-foreground text-xs',
      className
    )}>
      <Calendar className="w-3 h-3" />
      <span>{weeks} week{weeks === 1 ? '' : 's'} away</span>
    </div>
  );
}
