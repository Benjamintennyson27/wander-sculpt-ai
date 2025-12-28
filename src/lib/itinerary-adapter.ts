// Shared itinerary data types and adapter for TripDetail and TripCompare
// Data is stored in itineraries.days JSONB column

export interface ItineraryItem {
  title: string;
  description?: string;
  time_block: 'morning' | 'afternoon' | 'evening' | 'night';
  location_area?: string;
  duration_minutes?: number;
  cost_min?: number;
  cost_max?: number;
  kid_friendly?: boolean;
  food_related?: boolean;
  transit_tip?: string;
  assumptions?: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  notes?: string;
  items: ItineraryItem[];
}

export interface Itinerary {
  id: string;
  option_label: string;
  option_index: number;
  title: string;
  summary: string;
  why_good_for_you: string;
  pace: string;
  total_cost_min: number;
  total_cost_max: number;
  recommended: boolean;
  is_best_option: boolean;
  pros: string[];
  cons: string[];
  score: number;
  general_tips: string[];
  disclaimers: string[];
  days: ItineraryDay[];
}

export interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  budget_inr: number;
  is_family: boolean;
  status: string;
  selected_itinerary_id: string | null;
}

// Parse raw itinerary data from Supabase into typed Itinerary
export function parseItinerary(raw: any): Itinerary {
  // Parse days from JSON - handle both old and new format
  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  
  const days: ItineraryDay[] = rawDays.map((d: any) => ({
    day: d.day || d.day_number || 1,
    title: d.title || `Day ${d.day || d.day_number || 1}`,
    notes: d.notes || '',
    items: Array.isArray(d.items) ? d.items.map((item: any) => ({
      title: item.title || '',
      description: item.description || '',
      time_block: normalizeTimeBlock(item.time_block),
      location_area: item.location_area || '',
      duration_minutes: item.duration_minutes || 0,
      cost_min: item.cost_min || 0,
      cost_max: item.cost_max || 0,
      kid_friendly: item.kid_friendly || false,
      food_related: item.food_related || false,
      transit_tip: item.transit_tip || '',
      assumptions: item.assumptions || '',
    })) : [],
  }));

  return {
    id: raw.id,
    option_label: raw.option_label || String.fromCharCode(64 + raw.option_index),
    option_index: raw.option_index,
    title: raw.title || '',
    summary: raw.summary || '',
    why_good_for_you: raw.why_good_for_you || '',
    pace: raw.pace || 'moderate',
    total_cost_min: raw.total_cost_min || 0,
    total_cost_max: raw.total_cost_max || 0,
    recommended: raw.recommended || false,
    is_best_option: raw.is_best_option || false,
    pros: Array.isArray(raw.pros) ? raw.pros : [],
    cons: Array.isArray(raw.cons) ? raw.cons : [],
    score: raw.score || 0,
    general_tips: Array.isArray(raw.general_tips) ? raw.general_tips : [],
    disclaimers: Array.isArray(raw.disclaimers) ? raw.disclaimers : [],
    days,
  };
}

function normalizeTimeBlock(block: string): 'morning' | 'afternoon' | 'evening' | 'night' {
  const normalized = (block || 'morning').toLowerCase().trim();
  
  // Map variations to standard time blocks
  if (normalized.includes('morning') || normalized === 'early_morning') {
    return 'morning';
  }
  if (normalized.includes('afternoon') || normalized === 'midday' || normalized === 'lunch') {
    return 'afternoon';
  }
  if (normalized.includes('evening') || normalized === 'dusk' || normalized === 'sunset') {
    return 'evening';
  }
  if (normalized.includes('night') || normalized === 'dinner' || normalized === 'late') {
    return 'night';
  }
  
  return 'morning';
}

export function getTimeBlockOrder(block: string): number {
  const order: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, night: 3 };
  return order[block] ?? 4;
}

export function groupItemsByTimeBlock(items: ItineraryItem[]): Record<string, ItineraryItem[]> {
  const groups: Record<string, ItineraryItem[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  
  items.forEach(item => {
    const block = normalizeTimeBlock(item.time_block);
    groups[block].push(item);
  });
  
  return groups;
}

export function getPaceColor(pace: string): string {
  switch (pace) {
    case 'relaxed': return 'bg-green-500/20 text-green-400';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-400';
    case 'packed': return 'bg-red-500/20 text-red-400';
    default: return 'bg-muted text-muted-foreground';
  }
}
