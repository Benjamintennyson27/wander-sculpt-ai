import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyAuth, verifyTripOwnership, corsHeaders, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

// Input validation schema
const RequestSchema = z.object({
  trip_id: z.string().uuid(),
  itinerary_id: z.string().uuid().optional(),
  item_index: z.number().int().min(0).max(50),
  day_number: z.number().int().min(1).max(30),
});

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
    // 1. Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.success) {
      console.log('[activity-alternatives] Auth failed:', authResult.error);
      return unauthorizedResponse(authResult.error, authResult.status);
    }
    
    const userId = authResult.user.id;
    console.log('[activity-alternatives] Authenticated user:', userId);

    // 2. Parse and validate input
    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.log('[activity-alternatives] Validation failed:', parseResult.error.issues);
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { trip_id, itinerary_id, item_index, day_number } = parseResult.data;

    // 3. Verify trip ownership
    const ownershipResult = await verifyTripOwnership(trip_id, userId);
    if (!ownershipResult.owned) {
      console.log('[activity-alternatives] Ownership check failed:', ownershipResult.error);
      return forbiddenResponse(ownershipResult.error);
    }
    
    const trip = ownershipResult.trip!;
    console.log('[activity-alternatives] Trip ownership verified for:', trip_id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get itinerary - use provided itinerary_id or fall back to selected_itinerary_id
    const targetItineraryId = itinerary_id || trip.selected_itinerary_id;
    if (!targetItineraryId) {
      return new Response(
        JSON.stringify({ error: "No itinerary specified. Please select an itinerary option first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: itinerary, error: itinError } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", targetItineraryId)
      .single();

    if (itinError || !itinerary) {
      return new Response(
        JSON.stringify({ error: `Itinerary not found: ${itinError?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const days = itinerary.days || [];
    const dayIdx = day_number - 1;
    
    if (dayIdx < 0 || dayIdx >= days.length) {
      return new Response(
        JSON.stringify({ error: `Invalid day number: ${day_number}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentItem = days[dayIdx]?.items?.[item_index];
    if (!currentItem) {
      return new Response(
        JSON.stringify({ error: `Item not found at day ${day_number}, index ${item_index}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      console.error("[activity-alternatives] AI API error:", aiResponse.status, errorText);
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
    
    console.log("[activity-alternatives] AI response received");

    let result: { alternatives: Alternative[] };
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("[activity-alternatives] Failed to parse AI response:", e);
      throw new Error("Failed to generate alternatives");
    }

    // Validate and clean alternatives
    const alternatives = (result.alternatives || []).slice(0, 5).map(alt => ({
      title: String(alt.title || 'Unknown').slice(0, 200),
      area: String(alt.area || trip.destination).slice(0, 200),
      description: String(alt.description || '').slice(0, 1000),
      estimated_cost_min: Math.max(0, Math.min(10000000, Number(alt.estimated_cost_min) || 0)),
      estimated_cost_max: Math.max(Number(alt.estimated_cost_min) || 0, Math.min(10000000, Number(alt.estimated_cost_max) || 0)),
      duration_minutes: Math.max(0, Math.min(1440, Number(alt.duration_minutes) || 60)),
      category: String(alt.category || category).slice(0, 50),
      location_text: String(alt.location_text || alt.area || '').slice(0, 200),
      maps_query: String(alt.maps_query || `${alt.title} ${trip.destination}`).slice(0, 300),
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
    console.error("[activity-alternatives] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
