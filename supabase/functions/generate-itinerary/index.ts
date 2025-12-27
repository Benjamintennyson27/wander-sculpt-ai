import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CURRENT_TERMS_VERSION = '1.0';
const RATE_LIMIT_PER_HOUR = 3;
const MODEL_USED = 'google/gemini-2.5-flash';

// Scoring function to rank itineraries based on user preferences
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

interface ItineraryOption {
  option_index: number;
  title: string;
  summary: string;
  why_good_for_you?: string;
  days: unknown[];
  estimated_daily_budget?: string;
  pros?: string[];
  cons?: string[];
  pace?: string;
  family_friendly?: boolean;
  food_style_matches?: boolean;
}

function scoreItinerary(option: ItineraryOption, trip: TripData): number {
  let score = 50; // Base score

  // Family trip considerations (+15 if family-friendly for family trips)
  if (trip.is_family) {
    if (option.family_friendly !== false) score += 10;
    // Prefer relaxed/moderate pace for families
    if (option.pace === 'relaxed' || option.pace === 'moderate') score += 5;
    // Kids bonus
    if (trip.kids_count && trip.kids_count > 0) {
      if (option.title?.toLowerCase().includes('family') || 
          option.summary?.toLowerCase().includes('kid')) {
        score += 10;
      }
    }
  }

  // Pace alignment (+10)
  const optionPace = option.pace || 
    (option.title?.toLowerCase().includes('packed') ? 'packed' : 
     option.title?.toLowerCase().includes('relax') ? 'relaxed' : 'moderate');
  
  if (optionPace === trip.pace) score += 10;

  // Budget fit (+10)
  if (option.estimated_daily_budget && trip.duration_days) {
    const dailyBudget = trip.budget_inr / trip.duration_days;
    const estimatedBudget = parseInt(option.estimated_daily_budget.replace(/[^0-9]/g, '')) || 0;
    if (estimatedBudget > 0 && estimatedBudget <= dailyBudget * 1.2) {
      score += 10;
    }
  }

  // Food preference alignment (+5)
  if (option.food_style_matches) score += 5;

  // Interest coverage (+5 per matched interest, max 20)
  if (trip.interests && option.summary) {
    const summaryLower = option.summary.toLowerCase();
    let matched = 0;
    for (const interest of trip.interests) {
      if (summaryLower.includes(interest.toLowerCase())) {
        matched++;
      }
    }
    score += Math.min(matched * 5, 20);
  }

  // Travel style alignment (+5)
  if (trip.travel_style) {
    const titleLower = option.title?.toLowerCase() || '';
    if (trip.travel_style === 'adventure' && titleLower.includes('adventure')) score += 5;
    if (trip.travel_style === 'relaxed' && titleLower.includes('relax')) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

// Rate limiting check
async function checkRateLimit(supabase: SupabaseClient, userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get or create rate limit record
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

  // Create new record
  await supabase.from('rate_limits').insert({
    user_id: userId,
    date: today,
    generation_count: 0
  } as Record<string, unknown>);

  return { allowed: true, remaining: RATE_LIMIT_PER_HOUR };
}

// Increment rate limit counter
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

// Check terms acceptance
async function checkTermsAccepted(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('terms_acceptance')
    .select('id')
    .eq('user_id', userId)
    .eq('version', CURRENT_TERMS_VERSION)
    .maybeSingle();

  return !!data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tripId } = await req.json();
    
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
      console.log(`[generate-itinerary] Terms not accepted for user ${userId}`);
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
      console.log(`[generate-itinerary] Rate limit exceeded for user ${userId}`);
      return new Response(JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `You have reached the limit of ${RATE_LIMIT_PER_HOUR} generations per day. Try again tomorrow.`,
        remaining: 0
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete existing itineraries for this trip (regeneration)
    await supabase.from('itineraries').delete().eq('trip_id', tripId);

    // Build search queries for You API
    const youApiKey = Deno.env.get('YOU_API_KEY');
    let searchResults = '';
    const destination = tripData.destination as string;
    const foodPref = tripData.food_pref as string;
    const diet = tripData.diet as string;
    
    if (youApiKey) {
      const queries = [
        `top attractions in ${destination}`,
        `best ${foodPref === 'street_food' ? 'street food' : 'restaurants'} in ${destination} ${diet === 'veg' ? 'vegetarian' : ''}`,
        `local tips for visiting ${destination}`,
      ];

      for (const query of queries) {
        try {
          const searchResp = await fetch(`https://api.ydc-index.io/search?query=${encodeURIComponent(query)}`, {
            headers: { 'X-API-Key': youApiKey }
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const snippets = searchData.hits?.slice(0, 3).map((h: { title: string; description: string }) => 
              `${h.title}: ${h.description}`
            ).join('\n') || '';
            searchResults += `\n${query}:\n${snippets}\n`;
          }
        } catch (e) {
          console.log('[generate-itinerary] Search error:', e);
        }
      }
    }

    // Calculate trip duration
    const startDate = new Date(tripData.start_date as string);
    const endDate = new Date(tripData.end_date as string);
    const existingDuration = tripData.duration_days as number | null;
    const days = existingDuration || Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Build enhanced prompt with pros/cons request
    const isFamily = tripData.is_family as boolean;
    const budgetInr = tripData.budget_inr as number;
    const budgetStyle = tripData.budget_style as string;
    const adultsCount = tripData.adults_count as number || 1;
    const kidsCount = tripData.kids_count as number || 0;
    const pace = tripData.pace as string;
    const travelStyle = tripData.travel_style as string || 'mixed';
    const stayPreference = tripData.stay_preference as string;
    const interests = tripData.interests as string[] || [];
    const notes = tripData.notes as string;

    const prompt = `Create exactly 3 different travel itinerary options for a ${days}-day trip to ${destination}.

Trip Details:
- Budget: ₹${budgetInr} (${budgetStyle} style)
- Travelers: ${isFamily ? 'Family trip' : 'Individual/Friends'} - Adults: ${adultsCount}, Kids: ${kidsCount}
- Food preference: ${foodPref}, Diet: ${diet}
- Pace: ${pace}
- Travel style: ${travelStyle}
- Stay preference: ${stayPreference}
- Interests: ${JSON.stringify(interests)}
${notes ? `- Additional notes: ${notes}` : ''}

${searchResults ? `Recent search results for reference:\n${searchResults}` : ''}

Return ONLY valid JSON with this EXACT structure:
{
  "options": [
    {
      "option_index": 1,
      "title": "Adventure Seeker",
      "summary": "Brief 1-2 sentence summary",
      "why_good_for_you": "Why this matches their preferences",
      "pace": "relaxed|moderate|packed",
      "family_friendly": true,
      "estimated_daily_budget": "₹5000",
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "cons": ["Con 1", "Con 2"],
      "days": [
        {
          "day": 1,
          "morning": "Activity description with timing",
          "afternoon": "Activity description",
          "evening": "Activity description",
          "food": "Specific restaurant/food recommendations",
          "notes": "Travel tips, estimated costs"
        }
      ]
    }
  ],
  "best_option_index": 1,
  "general_tips": ["Tip 1", "Tip 2"],
  "disclaimers": ["Prices and timings may vary", "Please verify before visiting"]
}

Create exactly 3 diverse options with different paces/styles. Include realistic pros and cons for each. Option 1 should be ${pace || 'moderate'} pace.`;

    console.log(`[generate-itinerary] Calling AI for ${days}-day trip to ${destination}`);

    // Call Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_USED,
        messages: [
          { role: 'system', content: 'You are a travel planning expert. Return ONLY valid JSON, no markdown code blocks.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[generate-itinerary] AI error:', errText);
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || '';
    
    // Clean JSON (remove markdown code blocks if present)
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let itineraryData;
    try {
      itineraryData = JSON.parse(content);
    } catch (e) {
      console.error('[generate-itinerary] JSON parse error:', content.substring(0, 500));
      throw new Error('Invalid AI response format');
    }

    if (!itineraryData.options || !Array.isArray(itineraryData.options)) {
      console.error('[generate-itinerary] Invalid structure:', JSON.stringify(itineraryData).substring(0, 500));
      throw new Error('Invalid itinerary structure');
    }

    console.log(`[generate-itinerary] Received ${itineraryData.options.length} options from AI`);

    // Score each option
    const tripDataForScoring: TripData = {
      is_family: isFamily,
      pace: pace,
      budget_inr: budgetInr,
      duration_days: days,
      food_pref: foodPref,
      interests: interests,
      kids_count: kidsCount,
      travel_style: travelStyle
    };

    const scoredOptions = itineraryData.options.map((option: ItineraryOption) => ({
      ...option,
      score: scoreItinerary(option, tripDataForScoring)
    }));

    // Sort by score to find best
    scoredOptions.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    const bestOptionIndex = scoredOptions[0]?.option_index || 1;

    console.log(`[generate-itinerary] Scores: ${scoredOptions.map((o: ItineraryOption & { score: number }) => `Option ${o.option_index}: ${o.score}`).join(', ')}`);

    // Save itineraries with scores and pros/cons
    for (const option of scoredOptions) {
      const { error: insertError } = await supabase.from('itineraries').insert({
        trip_id: tripId,
        option_index: option.option_index,
        title: option.title,
        summary: option.summary,
        why_good_for_you: option.why_good_for_you,
        days: option.days,
        general_tips: itineraryData.general_tips || [],
        disclaimers: itineraryData.disclaimers || [],
        is_best_option: option.option_index === bestOptionIndex,
        pros: option.pros || [],
        cons: option.cons || [],
        score: option.score,
        model_used: MODEL_USED
      } as Record<string, unknown>);

      if (insertError) {
        console.error('[generate-itinerary] Insert error:', insertError);
      }
    }

    // Update trip status
    await supabase.from('trips').update({ 
      status: 'completed',
      duration_days: days
    } as Record<string, unknown>).eq('id', tripId);

    // Increment rate limit
    await incrementRateLimit(supabase, userId);

    console.log(`[generate-itinerary] Successfully generated ${scoredOptions.length} itineraries for trip ${tripId}`);

    return new Response(JSON.stringify({ 
      success: true,
      best_option: {
        option_index: bestOptionIndex,
        score: scoredOptions[0]?.score
      },
      remaining_generations: remaining - 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-itinerary] Error:', error);
    
    // Update trip status to failed
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
