/**
 * Itinerary Data Types and Adapter
 * Parses raw Supabase data into typed structures
 */

import { Source } from './format-activity';

// ============================================
// Types
// ============================================

export interface VerifiedFacts {
  verified_note?: string | null;
  hours_text?: string | null;
  price_text?: string | null;
  closed_day_text?: string | null;
  sources?: Source[];
  // Verification status fields
  status?: 'verified' | 'partial' | 'unverified' | 'failed';
  quality_score?: number;
  best_name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface ItineraryItem {
  title: string;
  description?: string;
  time_block: TimeBlock;
  location_area?: string;
  duration_minutes?: number;
  cost_min?: number;
  cost_max?: number;
  kid_friendly?: boolean;
  food_related?: boolean;
  transit_tip?: string;
  assumptions?: string;
  maps_query?: string;
  verified_facts?: VerifiedFacts;
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

// ============================================
// Constants
// ============================================

export type TimeBlock = 'morning' | 'afternoon' | 'evening' | 'night';

const TIME_BLOCKS: readonly TimeBlock[] = ['morning', 'afternoon', 'evening', 'night'];

const TIME_BLOCK_ORDER: Record<TimeBlock, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
};

// ============================================
// Helpers
// ============================================

function normalizeTimeBlock(block: string | undefined | null): TimeBlock {
  const normalized = (block || 'morning').toLowerCase().trim();
  
  if (normalized.includes('morning') || normalized === 'early_morning') return 'morning';
  if (normalized.includes('afternoon') || normalized === 'midday' || normalized === 'lunch' || normalized === 'late_afternoon') return 'afternoon';
  if (normalized.includes('evening') || normalized === 'dusk' || normalized === 'sunset') return 'evening';
  if (normalized.includes('night') || normalized === 'dinner' || normalized === 'late') return 'night';
  
  return 'morning';
}

function parseItem(item: Record<string, unknown>): ItineraryItem {
  return {
    title: String(item.title || ''),
    description: item.description ? String(item.description) : undefined,
    time_block: normalizeTimeBlock(item.time_block as string),
    location_area: item.location_area ? String(item.location_area) : undefined,
    duration_minutes: typeof item.duration_minutes === 'number' ? item.duration_minutes : undefined,
    cost_min: typeof item.cost_min === 'number' ? item.cost_min : undefined,
    cost_max: typeof item.cost_max === 'number' ? item.cost_max : undefined,
    kid_friendly: Boolean(item.kid_friendly),
    food_related: Boolean(item.food_related),
    transit_tip: item.transit_tip ? String(item.transit_tip) : undefined,
    assumptions: item.assumptions ? String(item.assumptions) : undefined,
    maps_query: item.maps_query ? String(item.maps_query) : undefined,
    verified_facts: item.verified_facts as VerifiedFacts | undefined,
  };
}

function parseDay(day: Record<string, unknown>): ItineraryDay {
  const dayNumber = (day.day as number) || (day.day_number as number) || 1;
  const items = Array.isArray(day.items) ? day.items.map(parseItem) : [];
  
  return {
    day: dayNumber,
    title: String(day.title || `Day ${dayNumber}`),
    notes: day.notes ? String(day.notes) : undefined,
    items,
  };
}

// ============================================
// Main Functions
// ============================================

/**
 * Parse raw itinerary data from Supabase into typed Itinerary
 */
export function parseItinerary(raw: Record<string, unknown>): Itinerary {
  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  const days = rawDays.map(parseDay);
  const optionIndex = typeof raw.option_index === 'number' ? raw.option_index : 1;
  
  return {
    id: String(raw.id || ''),
    option_label: String(raw.option_label || String.fromCharCode(64 + optionIndex)),
    option_index: optionIndex,
    title: String(raw.title || ''),
    summary: String(raw.summary || ''),
    why_good_for_you: String(raw.why_good_for_you || ''),
    pace: String(raw.pace || 'moderate'),
    total_cost_min: Number(raw.total_cost_min) || 0,
    total_cost_max: Number(raw.total_cost_max) || 0,
    recommended: Boolean(raw.recommended),
    is_best_option: Boolean(raw.is_best_option),
    pros: Array.isArray(raw.pros) ? raw.pros.map(String) : [],
    cons: Array.isArray(raw.cons) ? raw.cons.map(String) : [],
    score: Number(raw.score) || 0,
    general_tips: Array.isArray(raw.general_tips) ? raw.general_tips.map(String) : [],
    disclaimers: Array.isArray(raw.disclaimers) ? raw.disclaimers.map(String) : [],
    days,
  };
}

/**
 * Get numeric order for sorting time blocks
 */
export function getTimeBlockOrder(block: string): number {
  return TIME_BLOCK_ORDER[block as TimeBlock] ?? 4;
}

/**
 * Group items by their time block
 */
export function groupItemsByTimeBlock(items: ItineraryItem[]): Record<TimeBlock, ItineraryItem[]> {
  const groups: Record<TimeBlock, ItineraryItem[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  
  for (const item of items) {
    const block = normalizeTimeBlock(item.time_block);
    groups[block].push(item);
  }
  
  return groups;
}

/**
 * Get Tailwind classes for pace indicator
 */
export function getPaceColor(pace: string): string {
  switch (pace) {
    case 'relaxed': return 'bg-green-500/20 text-green-400';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-400';
    case 'packed': return 'bg-red-500/20 text-red-400';
    default: return 'bg-muted text-muted-foreground';
  }
}
