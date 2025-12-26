import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tripId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch trip details
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      throw new Error('Trip not found');
    }

    // Build search queries for You API
    const youApiKey = Deno.env.get('YOU_API_KEY');
    let searchResults = '';
    
    if (youApiKey) {
      const queries = [
        `top attractions in ${trip.destination}`,
        `best ${trip.food_pref === 'street_food' ? 'street food' : 'restaurants'} in ${trip.destination} ${trip.diet === 'veg' ? 'vegetarian' : ''}`,
        `local tips for visiting ${trip.destination}`,
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
          console.log('Search error:', e);
        }
      }
    }

    // Calculate trip duration
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Build prompt
    const prompt = `Create 3 different travel itinerary options for a ${days}-day trip to ${trip.destination}.

Trip Details:
- Budget: ₹${trip.budget_inr} (${trip.budget_style} style)
- Travelers: ${trip.is_family ? 'Family trip' : 'Individual/Friends'} - ${JSON.stringify(trip.travelers)}
- Food preference: ${trip.food_pref}, Diet: ${trip.diet}
- Pace: ${trip.pace}
- Stay preference: ${trip.stay_preference}
- Interests: ${JSON.stringify(trip.interests)}

${searchResults ? `Recent search results for reference:\n${searchResults}` : ''}

Return ONLY valid JSON with this structure:
{
  "options": [
    {
      "option_index": 1,
      "title": "Adventure Seeker",
      "summary": "Brief 1-2 sentence summary",
      "why_good_for_you": "Why this matches their preferences",
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

Create exactly 3 diverse options. Option ${trip.pace === 'relaxed' ? '1' : '3'} should be ${trip.pace}. Include realistic timings and local recommendations.`;

    // Call Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a travel planning expert. Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', errText);
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || '';
    
    // Clean JSON
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let itineraryData;
    try {
      itineraryData = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse error:', content);
      throw new Error('Invalid AI response format');
    }

    // Save itineraries
    for (const option of itineraryData.options) {
      await supabase.from('itineraries').insert({
        trip_id: tripId,
        option_index: option.option_index,
        title: option.title,
        summary: option.summary,
        why_good_for_you: option.why_good_for_you,
        days: option.days,
        general_tips: itineraryData.general_tips || [],
        disclaimers: itineraryData.disclaimers || [],
        is_best_option: option.option_index === itineraryData.best_option_index,
      });
    }

    // Update trip status
    await supabase.from('trips').update({ status: 'completed' }).eq('id', tripId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    
    // Update trip status to failed
    try {
      const { tripId } = await req.clone().json();
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase.from('trips').update({ status: 'failed' }).eq('id', tripId);
    } catch {}

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
