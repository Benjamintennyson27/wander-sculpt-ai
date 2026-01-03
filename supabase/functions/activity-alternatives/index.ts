import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Alternative {
  title: string;
  area: string;
  description: string;
  estimated_cost_min: number;
  estimated_cost_max: number;
  duration_minutes: number;
  category: string;
  location_text: string;
  maps_query: string;
  kid_friendly: boolean;
  food_related: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trip_id, itinerary_id, item_index, day_number } = await req.json();
    
    if (!trip_id || item_index === undefined || day_number === undefined) {
      return new Response(
        JSON.stringify({ error: "trip_id, day_number, and item_index are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get trip details
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", trip_id)
      .single();

    if (tripError || !trip) {
      throw new Error(`Trip not found: ${tripError?.message}`);
    }

    // Get itinerary - use provided itinerary_id or fall back to selected_itinerary_id
    const targetItineraryId = itinerary_id || trip.selected_itinerary_id;
    if (!targetItineraryId) {
      throw new Error("No itinerary specified. Please select an itinerary option first.");
    }

    const { data: itinerary, error: itinError } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", targetItineraryId)
      .single();

    if (itinError || !itinerary) {
      throw new Error(`Itinerary not found: ${itinError?.message}`);
    }

    const days = itinerary.days || [];
    const dayIdx = day_number - 1;
    
    if (dayIdx < 0 || dayIdx >= days.length) {
      throw new Error(`Invalid day number: ${day_number}`);
    }

    const currentItem = days[dayIdx]?.items?.[item_index];
    if (!currentItem) {
      throw new Error(`Item not found at day ${day_number}, index ${item_index}`);
    }

    // Detect category from current item
    const isFood = currentItem.food_related || /restaurant|cafe|food|eat|dine|breakfast|lunch|dinner/i.test(currentItem.title);
    const category = isFood ? 'food' : 'attraction';

    // Build prompt for AI
    const systemPrompt = `You are a travel expert for ${trip.destination}. Generate 5 alternative activities to replace the current one.

Current activity being replaced:
- Title: ${currentItem.title}
- Location: ${currentItem.location_area || 'Not specified'}
- Time block: ${currentItem.time_block}
- Description: ${currentItem.description || 'Not specified'}
- Category: ${category}
- Cost range: ₹${currentItem.cost_min || 0} - ₹${currentItem.cost_max || 0}

Trip context:
- Destination: ${trip.destination}
- Budget: ₹${trip.budget_inr}
- Is family trip: ${trip.is_family}
- Food preference: ${trip.food_pref || 'Not specified'}
- Interests: ${JSON.stringify(trip.interests || [])}

Generate 5 alternatives that:
1. Are in the same city/destination: ${trip.destination}
2. Fit the same time block (${currentItem.time_block})
3. Are similar category (${category}) but different experiences
4. Match the user's preferences and budget
5. Are real, verifiable places

Return a JSON object with this structure:
{
  "alternatives": [
    {
      "title": "Place/Activity Name",
      "area": "Neighborhood/Area in ${trip.destination}",
      "description": "Brief 1-2 sentence description",
      "estimated_cost_min": 100,
      "estimated_cost_max": 500,
      "duration_minutes": 90,
      "category": "${category}",
      "location_text": "Specific address or landmark",
      "maps_query": "Search query for Google Maps",
      "kid_friendly": true/false,
      "food_related": ${isFood}
    }
  ]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate 5 alternative ${category}s to replace "${currentItem.title}" in ${trip.destination}. Make them diverse but all appropriate for ${currentItem.time_block}.` }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "{}";
    
    console.log("AI response for alternatives:", responseText);

    let result: { alternatives: Alternative[] };
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      throw new Error("Failed to generate alternatives");
    }

    // Validate and clean alternatives
    const alternatives = (result.alternatives || []).slice(0, 5).map(alt => ({
      title: alt.title || 'Unknown',
      area: alt.area || trip.destination,
      description: alt.description || '',
      estimated_cost_min: Math.max(0, alt.estimated_cost_min || 0),
      estimated_cost_max: Math.max(alt.estimated_cost_min || 0, alt.estimated_cost_max || 0),
      duration_minutes: alt.duration_minutes || 60,
      category: alt.category || category,
      location_text: alt.location_text || alt.area || '',
      maps_query: alt.maps_query || `${alt.title} ${trip.destination}`,
      kid_friendly: Boolean(alt.kid_friendly),
      food_related: Boolean(alt.food_related),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        current_item: {
          title: currentItem.title,
          time_block: currentItem.time_block,
          day_number,
          item_index,
        },
        alternatives,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Alternatives error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
