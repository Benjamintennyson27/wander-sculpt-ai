import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyAuth, verifyTripOwnership, corsHeaders, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { callAI, parseAIJson, getAIErrorStatus } from "../_shared/ai-client.ts";
import { handleCors, jsonResponse, errorResponse, badRequest } from "../_shared/response.ts";
import { validateBody, sanitizeString, sanitizeNumber, sanitizeBoolean } from "../_shared/validation.ts";

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
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.success) {
      console.log('[activity-alternatives] Auth failed:', authResult.error);
      return unauthorizedResponse(authResult.error, authResult.status);
    }
    
    const userId = authResult.user.id;

    // 2. Validate input
    const { data: input, error: validationError } = await validateBody(req, RequestSchema);
    if (validationError) return validationError;
    
    const { trip_id, itinerary_id, item_index, day_number } = input;

    // 3. Verify trip ownership
    const ownershipResult = await verifyTripOwnership(trip_id, userId);
    if (!ownershipResult.owned) {
      return forbiddenResponse(ownershipResult.error);
    }
    
    const trip = ownershipResult.trip!;
    const supabase = getServiceClient();

    // Get itinerary
    const targetItineraryId = itinerary_id || trip.selected_itinerary_id;
    if (!targetItineraryId) {
      return badRequest("No itinerary specified. Please select an itinerary option first.");
    }

    const { data: itinerary, error: itinError } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", targetItineraryId)
      .single();

    if (itinError || !itinerary) {
      return errorResponse(`Itinerary not found: ${itinError?.message}`, 404);
    }

    const days = itinerary.days || [];
    const dayIdx = day_number - 1;
    
    if (dayIdx < 0 || dayIdx >= days.length) {
      return badRequest(`Invalid day number: ${day_number}`);
    }

    const currentItem = days[dayIdx]?.items?.[item_index];
    if (!currentItem) {
      return errorResponse(`Item not found at day ${day_number}, index ${item_index}`, 404);
    }

    // Detect category
    const isFood = currentItem.food_related || /restaurant|cafe|food|eat|dine|breakfast|lunch|dinner/i.test(currentItem.title);
    const category = isFood ? 'food' : 'attraction';

    // Build AI prompt
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
      "area": "Neighborhood/Area",
      "description": "Brief 1-2 sentence description",
      "estimated_cost_min": 100,
      "estimated_cost_max": 500,
      "duration_minutes": 90,
      "category": "${category}",
      "location_text": "Specific address or landmark",
      "maps_query": "Search query for Google Maps",
      "kid_friendly": true,
      "food_related": ${isFood}
    }
  ]
}`;

    // Call AI
    const aiResponse = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate 5 alternative ${category}s to replace "${currentItem.title}" in ${trip.destination}. Make them diverse but all appropriate for ${currentItem.time_block}.` }
      ],
      jsonResponse: true,
    });

    const result = parseAIJson<{ alternatives: Alternative[] }>(aiResponse.content, { alternatives: [] });

    // Validate and clean alternatives
    const alternatives = (result.alternatives || []).slice(0, 5).map(alt => ({
      title: sanitizeString(alt.title, 200, 'Unknown'),
      area: sanitizeString(alt.area, 200, trip.destination as string),
      description: sanitizeString(alt.description, 1000),
      estimated_cost_min: sanitizeNumber(alt.estimated_cost_min, 0, 10000000),
      estimated_cost_max: Math.max(sanitizeNumber(alt.estimated_cost_min, 0), sanitizeNumber(alt.estimated_cost_max, 0, 10000000)),
      duration_minutes: sanitizeNumber(alt.duration_minutes, 0, 1440, 60),
      category: sanitizeString(alt.category, 50, category),
      location_text: sanitizeString(alt.location_text || alt.area, 200),
      maps_query: sanitizeString(alt.maps_query, 300, `${alt.title} ${trip.destination}`),
      kid_friendly: sanitizeBoolean(alt.kid_friendly),
      food_related: sanitizeBoolean(alt.food_related),
    }));

    return jsonResponse({
      success: true,
      current_item: {
        title: currentItem.title,
        time_block: currentItem.time_block,
        day_number,
        item_index,
      },
      alternatives,
    });

  } catch (error) {
    console.error("[activity-alternatives] Error:", error);
    const status = getAIErrorStatus(error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error", status);
  }
});