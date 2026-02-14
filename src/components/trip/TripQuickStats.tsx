import { TripCountdown } from './TripCountdown';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, BudgetSummary } from '@/lib/budget-calculator';
import { Itinerary, Trip } from '@/lib/itinerary-adapter';
import { 
  CalendarDays, Activity, Utensils, TrendingUp, 
  BadgeCheck, Wallet, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripQuickStatsProps {
  trip: Trip;
  itinerary: Itinerary | null;
  budgetSummary: BudgetSummary | null;
  className?: string;
}

export function TripQuickStats({ trip, itinerary, budgetSummary, className }: TripQuickStatsProps) {
  const totalActivities = itinerary?.days.reduce((sum, day) => sum + day.items.length, 0) ?? 0;
  const totalDays = itinerary?.days.length ?? 0;
  const foodItems = itinerary?.days.reduce(
    (sum, day) => sum + day.items.filter(i => i.food_related).length, 0
  ) ?? 0;
  const verifiedCount = itinerary?.days.reduce(
    (sum, day) => sum + day.items.filter(i => i.verified_facts?.status === 'verified').length, 0
  ) ?? 0;

  const avgEstimate = budgetSummary ? (budgetSummary.totalMin + budgetSummary.totalMax) / 2 : 0;
  const budgetPercent = trip.budget_inr > 0 ? Math.min((avgEstimate / trip.budget_inr) * 100, 100) : 0;

  return (
    <div className={cn('rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 space-y-5', className)}>
      {/* Header with countdown */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-display font-semibold flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          Trip Stats
        </h3>
        <TripCountdown startDate={trip.start_date} endDate={trip.end_date} />
      </div>

      {/* Quick stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={CalendarDays} label="Duration" value={`${totalDays} days`} />
        <StatCard icon={Activity} label="Activities" value={String(totalActivities)} />
        <StatCard icon={Utensils} label="Food Stops" value={String(foodItems)} />
        <StatCard icon={BadgeCheck} label="Verified" value={`${verifiedCount}/${totalActivities}`} />
      </div>

      {/* Budget section */}
      {budgetSummary && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Budget Usage
            </span>
            <span className="font-medium">
              {formatCurrency(avgEstimate)} / {formatCurrency(trip.budget_inr)}
            </span>
          </div>
          <Progress value={budgetPercent} className="h-2" />
          {budgetSummary.overBudget && (
            <Badge variant="destructive" className="text-[10px]">
              Over budget by {formatCurrency(Math.abs(budgetSummary.budgetDifference))}
            </Badge>
          )}

          {/* Category split */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Food</p>
              <p className="text-sm font-semibold">
                {formatCurrency((budgetSummary.foodTotalMin + budgetSummary.foodTotalMax) / 2)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Activities</p>
              <p className="text-sm font-semibold">
                {formatCurrency((budgetSummary.activitiesTotalMin + budgetSummary.activitiesTotalMax) / 2)}
              </p>
            </div>
          </div>

          {/* Average daily cost */}
          <div className="flex items-center justify-between text-sm pt-1 border-t border-border/50">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Avg. Daily Cost
            </span>
            <span className="font-medium">{formatCurrency(budgetSummary.averagePerDay)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-3">
      <div className="rounded-md bg-primary/10 p-1.5">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
