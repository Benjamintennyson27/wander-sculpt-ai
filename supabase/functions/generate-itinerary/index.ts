import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CURRENT_TERMS_VERSION = '1.0';
const RATE_LIMIT_PER_HOUR = 3;
const MODEL_USED = 'google/gemini-2.5-flash';

// Zod-like validation (simplified for edge function)
interface TripInput {
  tripId: string;
}

interface TripData {
  is_family: boolean;
  pace: string;
  budget_inr: number;
  duration_days?: number;
  food_pref: string;
  interests: string[];
  kids_count?: number;
  travel_style?: string;
}

interface ItineraryItem {
  time_block: 'morning' | 'afternoon' | 'evening' | 'night';
  title: string;
  description?: string;
  location_area?: string;
  duration_minutes?: number;
  cost_min?: number;
  cost_max?: number;
  kid_friendly?: boolean;
  food_related?: boolean;
  transit_tip?: string;
  assumptions?: string;
}

interface ItineraryDay {
  day: number;
  title: string;
  notes?: string;
  items: ItineraryItem[];
}

interface ItineraryOption {
  option_index: number;
  option_label: string;
  title: string;
  summary: string;
  why_good_for_you?: string;
  pace: 'relaxed' | 'moderate' | 'packed';
  total_cost_min?: number;
  total_cost_max?: number;
  recommended?: boolean;
  family_friendly?: boolean;
  pros?: string[];
  cons?: string[];
  days: ItineraryDay[];
}

interface AIResponse {
  options: ItineraryOption[];
  best_option_index: number;
  general_tips?: string[];
  disclaimers?: string[];
}

function validateInput(data: unknown): TripInput {
  if (!data || typeof data !== 'object') throw new Error('Invalid input');
  const obj = data as Record<string, unknown>;
  if (typeof obj.tripId !== 'string' || !obj.tripId.match(/^[0-9a-f-]{36}$/)) {
    throw new Error('Invalid tripId format');
  }
  return { tripId: obj.tripId };
}

function validateAIResponse(data: unknown, retryCount: number): AIResponse {
  if (!data || typeof data !== 'object') throw new Error('Invalid AI response');
  const obj = data as Record<string, unknown>;
  
  if (!Array.isArray(obj.options) || obj.options.length === 0) {
    throw new Error('Missing options array');
  }
  
  const options: ItineraryOption[] = [];
  const labels = ['A', 'B', 'C'];
  
  for (let i = 0; i < obj.options.length && i < 3; i++) {
    const opt = obj.options[i] as Record<string, unknown>;
    if (!opt.title || !opt.days || !Array.isArray(opt.days)) {
      if (retryCount === 0) throw new Error(`Invalid option ${i + 1}`);
      continue;
    }
    
    const days: ItineraryDay[] = [];
    for (const d of opt.days as Record<string, unknown>[]) {
      const items: ItineraryItem[] = [];
      
      // Parse legacy format (morning/afternoon/evening fields) or new items array
      if (Array.isArray(d.items)) {
        for (const item of d.items as Record<string, unknown>[]) {
          items.push({
            time_block: (item.time_block as string || 'morning') as ItineraryItem['time_block'],
            title: item.title as string || 'Activity',
            description: item.description as string,
            location_area: item.location_area as string,
            duration_minutes: item.duration_minutes as number,
            cost_min: item.cost_min as number,
            cost_max: item.cost_max as number,
            kid_friendly: item.kid_friendly as boolean,
            food_related: item.food_related as boolean,
            transit_tip: item.transit_tip as string,
            assumptions: item.assumptions as string,
          });
        }
      } else {
        // Legacy format - convert morning/afternoon/evening to items
        if (d.morning) {
          items.push({
            time_block: 'morning',
            title: d.morning as string,
            description: d.morning as string,
          });
        }
        if (d.afternoon) {
          items.push({
            time_block: 'afternoon',
            title: d.afternoon as string,
            description: d.afternoon as string,
          });
        }
        if (d.evening) {
          items.push({
            time_block: 'evening',
            title: d.evening as string,
            description: d.evening as string,
          });
        }
        if (d.food) {
          items.push({
            time_block: 'night',
            title: 'Food Recommendations',
            description: d.food as string,
            food_related: true,
          });
        }
      }
      
      days.push({
        day: (d.day as number) || days.length + 1,
        title: (d.title as string) || `Day ${days.length + 1}`,
        notes: d.notes as string,
        items,
      });
    }
    
    options.push({
      option_index: i + 1,
      option_label: labels[i],
      title: opt.title as string,
      summary: opt.summary as string || '',
      why_good_for_you: opt.why_good_for_you as string,
      pace: (opt.pace as string || 'moderate') as ItineraryOption['pace'],
      total_cost_min: opt.total_cost_min as number,
      total_cost_max: opt.total_cost_max as number,
      recommended: opt.recommended as boolean,
      family_friendly: opt.family_friendly as boolean,
      pros: (opt.pros as string[]) || [],
      cons: (opt.cons as string[]) || [],
      days,
    });
  }
  
  return {
    options,
    best_option_index: (obj.best_option_index as number) || 1,
    general_tips: obj.general_tips as string[],
    disclaimers: obj.disclaimers as string[],
  };
}

function scoreItinerary(option: ItineraryOption, trip: TripData): number {
  let score = 50;

  if (trip.is_family) {
    if (option.family_friendly !== false) score += 10;
    if (option.pace === 'relaxed' || option.pace === 'moderate') score += 5;
    if (trip.kids_count && trip.kids_count > 0) {
      if (option.title?.toLowerCase().includes('family') || 
          option.summary?.toLowerCase().includes('kid')) {
        score += 10;
      }
    }
  }

  if (option.pace === trip.pace) score += 10;

  if (option.total_cost_max && trip.budget_inr) {
    if (option.total_cost_max <= trip.budget_inr * 1.1) score += 10;
  }

  if (trip.interests && option.summary) {
    const summaryLower = option.summary.toLowerCase();
    let matched = 0;
    for (const interest of trip.interests) {
      if (summaryLower.includes(interest.toLowerCase())) matched++;
    }
    score += Math.min(matched * 5, 20);
  }

  if (trip.travel_style) {
    const titleLower = option.title?.toLowerCase() || '';
    if (trip.travel_style === 'adventure' && titleLower.includes('adventure')) score += 5;
    if (trip.travel_style === 'relaxed' && titleLower.includes('relax')) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

async function checkRateLimit(supabase: SupabaseClient, userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('id, generation_count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    const count = (existing as { id: string; generation_count: number }).generation_count;
    const remaining = Math.max(0, RATE_LIMIT_PER_HOUR - count);
    return { allowed: count < RATE_LIMIT_PER_HOUR, remaining };
  }

  await supabase.from('rate_limits').insert({
    user_id: userId,
    date: today,
    generation_count: 0
  } as Record<string, unknown>);

  return { allowed: true, remaining: RATE_LIMIT_PER_HOUR };
}

async function incrementRateLimit(supabase: SupabaseClient, userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('rate_limits')
    .select('id, generation_count')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    const record = existing as { id: string; generation_count: number };
    await supabase
      .from('rate_limits')
      .update({ generation_count: record.generation_count + 1 } as Record<string, unknown>)
      .eq('id', record.id);
  }
}

async function checkTermsAccepted(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('terms_acceptance')
    .select('id')
    .eq('user_id', userId)
    .eq('version', CURRENT_TERMS_VERSION)
    .maybeSingle();

  return !!data;
}

async function callAI(prompt: string, retryCount: number = 0): Promise<AIResponse> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  const systemPrompt = retryCount > 0 
    ? 'You are a travel planning expert. Return ONLY valid JSON. NO markdown, NO code blocks, NO explanations. If any data is uncertain (weather, hours, prices), include an "assumptions" field.'
    : 'You are a travel planning expert. Return ONLY valid JSON, no markdown code blocks.';

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_USED,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[generate-itinerary] AI error:', errText);
    throw new Error('AI generation failed');
  }

  const aiData = await response.json();
  let content = aiData.choices?.[0]?.message?.content || '';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    const parsed = JSON.parse(content);
    return validateAIResponse(parsed, retryCount);
  } catch (e) {
    console.error('[generate-itinerary] Parse error:', e, content.substring(0, 500));
    if (retryCount === 0) {
      console.log('[generate-itinerary] Retrying with stricter prompt...');
      return callAI(prompt, 1);
    }
    throw new Error('Invalid AI response format after retry');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input = validateInput(await req.json());
    const { tripId } = input;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch trip details
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      console.error('[generate-itinerary] Trip not found:', tripError);
      throw new Error('Trip not found');
    }

    const tripData = trip as Record<string, unknown>;
    const userId = tripData.user_id as string;
    console.log(`[generate-itinerary] Starting for trip ${tripId}, user ${userId}`);

    // Check terms acceptance
    const termsAccepted = await checkTermsAccepted(supabase, userId);
    if (!termsAccepted) {
      return new Response(JSON.stringify({
        error: 'TERMS_REQUIRED',
        message: 'Please accept terms and conditions before generating',
        terms_version: CURRENT_TERMS_VERSION
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(supabase, userId);
    if (!allowed) {
      return new Response(JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `You have reached the limit of ${RATE_LIMIT_PER_HOUR} generations per day.`,
        remaining: 0
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete existing data for this trip (regeneration)
    const { data: existingItineraries } = await supabase
      .from('itineraries')
      .select('id')
      .eq('trip_id', tripId);
    
    if (existingItineraries && existingItineraries.length > 0) {
      const itineraryIds = existingItineraries.map(i => i.id);
      
      // Get day IDs for cascade delete
      const { data: existingDays } = await supabase
        .from('itinerary_days')
        .select('id')
        .in('itinerary_id', itineraryIds);
      
      if (existingDays && existingDays.length > 0) {
        const dayIds = existingDays.map(d => d.id);
        await supabase.from('itinerary_items').delete().in('itinerary_day_id', dayIds);
        await supabase.from('itinerary_days').delete().in('itinerary_id', itineraryIds);
      }
      
      await supabase.from('itineraries').delete().eq('trip_id', tripId);
    }

    // Calculate trip duration
    const startDate = new Date(tripData.start_date as string);
    const endDate = new Date(tripData.end_date as string);
    const existingDuration = tripData.duration_days as number | null;
    const days = existingDuration || Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Build prompt
    const destination = tripData.destination as string;
    const isFamily = tripData.is_family as boolean;
    const budgetInr = tripData.budget_inr as number;
    const budgetStyle = tripData.budget_style as string;
    const adultsCount = tripData.adults_count as number || 1;
    const kidsCount = tripData.kids_count as number || 0;
    const pace = tripData.pace as string || 'moderate';
    const foodPref = tripData.food_pref as string;
    const diet = tripData.diet as string;
    const travelStyle = tripData.travel_style as string || 'mixed';
    const interests = tripData.interests as string[] || [];
    const notes = tripData.notes as string;

    const prompt = `Create exactly 3 different travel itinerary options for a ${days}-day trip to ${destination}.

Trip Details:
- Budget: ₹${budgetInr} total (${budgetStyle} style)
- Travelers: ${isFamily ? 'Family trip' : 'Individual/Friends'} - Adults: ${adultsCount}, Kids: ${kidsCount}
- Food preference: ${foodPref}, Diet: ${diet}
- Pace: ${pace}
- Travel style: ${travelStyle}
- Interests: ${JSON.stringify(interests)}
${notes ? `- Additional notes: ${notes}` : ''}

Return ONLY valid JSON with this EXACT structure:
{
  "options": [
    {
      "option_index": 1,
      "option_label": "A",
      "title": "Adventure Seeker",
      "summary": "Brief 1-2 sentence summary",
      "why_good_for_you": "Why this matches their preferences",
      "pace": "relaxed|moderate|packed",
      "total_cost_min": 15000,
      "total_cost_max": 20000,
      "family_friendly": true,
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "cons": ["Con 1", "Con 2"],
      "days": [
        {
          "day": 1,
          "title": "Day 1 - Arrival & Exploration",
          "notes": "General notes for the day",
          "items": [
            {
              "time_block": "morning",
              "title": "Check-in at hotel",
              "description": "Settle in and freshen up",
              "location_area": "City Center",
              "duration_minutes": 60,
              "cost_min": 0,
              "cost_max": 0,
              "kid_friendly": true,
              "food_related": false,
              "transit_tip": "Take airport taxi, ~₹500",
              "assumptions": "Check-in time 2PM"
            },
            {
              "time_block": "afternoon",
              "title": "Visit Local Market",
              "description": "Explore local shops and street vendors",
              "location_area": "Old Town",
              "duration_minutes": 180,
              "cost_min": 500,
              "cost_max": 2000,
              "kid_friendly": true,
              "food_related": false,
              "transit_tip": "Walking distance from hotel"
            },
            {
              "time_block": "evening",
              "title": "Dinner at Authentic Restaurant",
              "description": "Try local cuisine",
              "location_area": "Food Street",
              "duration_minutes": 90,
              "cost_min": 800,
              "cost_max": 1500,
              "kid_friendly": true,
              "food_related": true
            }
          ]
        }
      ]
    }
  ],
  "best_option_index": 1,
  "general_tips": ["Tip 1", "Tip 2"],
  "disclaimers": ["Prices may vary", "Verify timings before visiting"]
}

Create 3 diverse options: Option A (${pace}), Option B (alternative pace), Option C (budget-focused).
Mark option_index 1 as recommended if it best matches preferences.
Include realistic cost estimates in INR. Mark any uncertain data in "assumptions" field.`;

    console.log(`[generate-itinerary] Calling AI for ${days}-day trip to ${destination}`);

    const aiResponse = await callAI(prompt);
    
    // Score each option
    const tripDataForScoring: TripData = {
      is_family: isFamily,
      pace,
      budget_inr: budgetInr,
      duration_days: days,
      food_pref: foodPref,
      interests,
      kids_count: kidsCount,
      travel_style: travelStyle
    };

    const scoredOptions = aiResponse.options.map(option => ({
      ...option,
      score: scoreItinerary(option, tripDataForScoring)
    }));

    scoredOptions.sort((a, b) => b.score - a.score);
    const bestOptionIndex = scoredOptions[0]?.option_index || 1;

    console.log(`[generate-itinerary] Scores: ${scoredOptions.map(o => `${o.option_label}: ${o.score}`).join(', ')}`);

    // Save itineraries with new granular structure
    const savedItineraries = [];
    
    for (const option of scoredOptions) {
      // Insert main itinerary record
      const { data: itinerary, error: insertError } = await supabase
        .from('itineraries')
        .insert({
          trip_id: tripId,
          option_index: option.option_index,
          option_label: option.option_label,
          title: option.title,
          summary: option.summary,
          why_good_for_you: option.why_good_for_you,
          pace: option.pace,
          total_cost_min: option.total_cost_min,
          total_cost_max: option.total_cost_max,
          recommended: option.option_index === bestOptionIndex,
          is_best_option: option.option_index === bestOptionIndex,
          pros: option.pros || [],
          cons: option.cons || [],
          score: option.score,
          model_used: MODEL_USED,
          days: option.days, // Keep legacy field for compatibility
          general_tips: aiResponse.general_tips || [],
          disclaimers: aiResponse.disclaimers || [],
        } as Record<string, unknown>)
        .select('id')
        .single();

      if (insertError || !itinerary) {
        console.error('[generate-itinerary] Insert itinerary error:', insertError);
        continue;
      }

      const itineraryId = itinerary.id;
      savedItineraries.push({ ...option, id: itineraryId });

      // Insert days and items
      for (const day of option.days) {
        const { data: dayRecord, error: dayError } = await supabase
          .from('itinerary_days')
          .insert({
            itinerary_id: itineraryId,
            day_number: day.day,
            title: day.title,
            notes: day.notes,
          } as Record<string, unknown>)
          .select('id')
          .single();

        if (dayError || !dayRecord) {
          console.error('[generate-itinerary] Insert day error:', dayError);
          continue;
        }

        const dayId = dayRecord.id;

        // Insert items for this day
        for (const item of day.items) {
          const { error: itemError } = await supabase
            .from('itinerary_items')
            .insert({
              itinerary_day_id: dayId,
              time_block: item.time_block,
              title: item.title,
              description: item.description,
              location_area: item.location_area,
              duration_minutes: item.duration_minutes,
              cost_min: item.cost_min,
              cost_max: item.cost_max,
              kid_friendly: item.kid_friendly,
              food_related: item.food_related,
              transit_tip: item.transit_tip,
              assumptions: item.assumptions,
            } as Record<string, unknown>);

          if (itemError) {
            console.error('[generate-itinerary] Insert item error:', itemError);
          }
        }
      }
    }

    // Update trip status
    await supabase.from('trips').update({ 
      status: 'completed',
      duration_days: days
    } as Record<string, unknown>).eq('id', tripId);

    // Increment rate limit
    await incrementRateLimit(supabase, userId);

    console.log(`[generate-itinerary] Successfully generated ${savedItineraries.length} itineraries`);

    return new Response(JSON.stringify({ 
      success: true,
      itineraries: savedItineraries.map(it => ({
        id: it.id,
        option_label: it.option_label,
        title: it.title,
        score: it.score,
        recommended: it.option_index === bestOptionIndex,
      })),
      best_option_index: bestOptionIndex,
      remaining_generations: remaining - 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-itinerary] Error:', error);
    
    try {
      const { tripId } = await req.clone().json();
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase.from('trips').update({ status: 'failed' } as Record<string, unknown>).eq('id', tripId);
    } catch {}

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
