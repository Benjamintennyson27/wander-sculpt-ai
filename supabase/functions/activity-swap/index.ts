import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyAuth, verifyTripOwnership, corsHeaders, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { handleCors, jsonResponse, errorResponse, badRequest } from "../_shared/response.ts";
import { validateBody, sanitizeString, sanitizeNumber, sanitizeBoolean } from "../_shared/validation.ts";

// Input validation schema
const NewItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  location_text: z.string().max(200).optional(),
  area: z.string().max(200).optional(),
  duration_minutes: z.number().int().min(0).max(1440).optional(),
  estimated_cost_min: z.number().int().min(0).max(10000000).optional(),
  estimated_cost_max: z.number().int().min(0).max(10000000).optional(),
  kid_friendly: z.boolean().optional(),
  food_related: z.boolean().optional(),
  maps_query: z.string().max(300).optional(),
});

const RequestSchema = z.object({
  trip_id: z.string().uuid(),
  itinerary_id: z.string().uuid().optional(),
  day_number: z.number().int().min(1).max(30),
  item_index: z.number().int().min(0).max(50),
  new_item: NewItemSchema,
  auto_verify: z.boolean().optional(),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.success) {
      console.log('[activity-swap] Auth failed:', authResult.error);
      return unauthorizedResponse(authResult.error, authResult.status);
    }
    
    const userId = authResult.user.id;

    // 2. Validate input
    const { data: input, error: validationError } = await validateBody(req, RequestSchema);
    if (validationError) return validationError;
    
    const { trip_id, itinerary_id, day_number, item_index, new_item, auto_verify } = input;

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

    const days = [...(itinerary.days || [])];
    const dayIdx = day_number - 1;
    
    if (dayIdx < 0 || dayIdx >= days.length) {
      return badRequest(`Invalid day number: ${day_number}`);
    }

    const day = days[dayIdx];
    const items = [...(day.items || [])];
    
    if (item_index < 0 || item_index >= items.length) {
      return badRequest(`Invalid item index: ${item_index}`);
    }

    const oldItem = items[item_index];

    // Build the new item preserving time_block
    const swappedItem = {
      title: sanitizeString(new_item.title, 200),
      description: sanitizeString(new_item.description, 1000),
      time_block: oldItem.time_block,
      location_area: sanitizeString(new_item.location_text || new_item.area, 200),
      duration_minutes: new_item.duration_minutes ?? oldItem.duration_minutes,
      cost_min: new_item.estimated_cost_min ?? oldItem.cost_min,
      cost_max: new_item.estimated_cost_max ?? oldItem.cost_max,
      kid_friendly: new_item.kid_friendly ?? oldItem.kid_friendly,
      food_related: new_item.food_related ?? oldItem.food_related,
      maps_query: sanitizeString(new_item.maps_query, 300, `${new_item.title} ${trip.destination}`),
      transit_tip: oldItem.transit_tip,
    };

    items[item_index] = swappedItem;
    days[dayIdx] = { ...day, items };

    // Update itinerary
    const { error: updateError } = await supabase
      .from("itineraries")
      .update({ days })
      .eq("id", targetItineraryId);

    if (updateError) {
      console.error("[activity-swap] Failed to update itinerary:", updateError);
      return errorResponse("Failed to swap activity", 500);
    }

    // Log the edit
    await supabase.from("itinerary_edits_log").insert({
      trip_id,
      option_id: itinerary.option_label || 'A',
      action: 'replace_item',
      payload: {
        day_number,
        item_index,
        old_item: { title: oldItem.title, location_area: oldItem.location_area },
        new_item: { title: swappedItem.title, location_area: swappedItem.location_area },
      },
    });

    // Optionally trigger verification
    if (auto_verify) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const authHeader = req.headers.get("Authorization");
        
        await fetch(`${supabaseUrl}/functions/v1/verify-place`, {
          method: "POST",
          headers: {
            Authorization: authHeader || `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trip_id,
            itinerary_item_id: `${targetItineraryId}-d${day_number}-i${item_index}`,
            query: swappedItem.maps_query || swappedItem.title,
            destination: trip.destination,
          }),
        });
      } catch (e) {
        console.warn("[activity-swap] Auto-verify error:", e);
      }
    }

    return jsonResponse({
      success: true,
      message: `Replaced "${oldItem.title}" with "${swappedItem.title}"`,
      swapped_item: swappedItem,
      day_number,
      item_index,
    });

  } catch (error) {
    console.error("[activity-swap] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error", 500);
  }
});