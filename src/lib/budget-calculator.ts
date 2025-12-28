// Budget calculation utilities for itineraries
import { Itinerary, ItineraryDay, ItineraryItem } from './itinerary-adapter';

export interface DayBudget {
  day: number;
  title: string;
  costMin: number;
  costMax: number;
  itemCount: number;
  foodCostMin: number;
  foodCostMax: number;
}

export interface BudgetSummary {
  totalMin: number;
  totalMax: number;
  dailyBreakdown: DayBudget[];
  foodTotalMin: number;
  foodTotalMax: number;
  activitiesTotalMin: number;
  activitiesTotalMax: number;
  averagePerDay: number;
  overBudget: boolean;
  budgetDifference: number;
}

export function calculateBudget(itinerary: Itinerary, userBudget: number): BudgetSummary {
  const dailyBreakdown: DayBudget[] = itinerary.days.map(day => {
    const foodItems = day.items.filter(item => item.food_related);
    const foodCostMin = foodItems.reduce((sum, item) => sum + (item.cost_min || 0), 0);
    const foodCostMax = foodItems.reduce((sum, item) => sum + (item.cost_max || 0), 0);
    
    const costMin = day.items.reduce((sum, item) => sum + (item.cost_min || 0), 0);
    const costMax = day.items.reduce((sum, item) => sum + (item.cost_max || 0), 0);
    
    return {
      day: day.day,
      title: day.title,
      costMin,
      costMax,
      itemCount: day.items.length,
      foodCostMin,
      foodCostMax,
    };
  });

  const totalMin = dailyBreakdown.reduce((sum, day) => sum + day.costMin, 0);
  const totalMax = dailyBreakdown.reduce((sum, day) => sum + day.costMax, 0);
  const foodTotalMin = dailyBreakdown.reduce((sum, day) => sum + day.foodCostMin, 0);
  const foodTotalMax = dailyBreakdown.reduce((sum, day) => sum + day.foodCostMax, 0);
  
  const averageEstimate = (totalMin + totalMax) / 2;
  const overBudget = averageEstimate > userBudget;
  const budgetDifference = userBudget - averageEstimate;

  return {
    totalMin,
    totalMax,
    dailyBreakdown,
    foodTotalMin,
    foodTotalMax,
    activitiesTotalMin: totalMin - foodTotalMin,
    activitiesTotalMax: totalMax - foodTotalMax,
    averagePerDay: itinerary.days.length > 0 ? averageEstimate / itinerary.days.length : 0,
    overBudget,
    budgetDifference,
  };
}

export function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}k`;
  }
  return `₹${amount}`;
}
