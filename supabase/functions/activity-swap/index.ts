import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyAuth, verifyTripOwnership, corsHeaders, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.success) {
      console.log('[activity-swap] Auth failed:', authResult.error);
      return unauthorizedResponse(authResult.error, authResult.status);
    }
    
    const userId = authResult.user.id;
    console.log('[activity-swap] Authenticated user:', userId);

    // 2. Parse and validate input
    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.log('[activity-swap] Validation failed:', parseResult.error.issues);
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { trip_id, itinerary_id, day_number, item_index, new_item, auto_verify } = parseResult.data;

    // 3. Verify trip ownership
    const ownershipResult = await verifyTripOwnership(trip_id, userId);
    if (!ownershipResult.owned) {
      console.log('[activity-swap] Ownership check failed:', ownershipResult.error);
      return forbiddenResponse(ownershipResult.error);
    }
    
    const trip = ownershipResult.trip!;
    console.log('[activity-swap] Trip ownership verified for:', trip_id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const days = [...(itinerary.days || [])];
    const dayIdx = day_number - 1;
    
    if (dayIdx < 0 || dayIdx >= days.length) {
      return new Response(
        JSON.stringify({ error: `Invalid day number: ${day_number}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const day = days[dayIdx];
    const items = [...(day.items || [])];
    
    if (item_index < 0 || item_index >= items.length) {
      return new Response(
        JSON.stringify({ error: `Invalid item index: ${item_index}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldItem = items[item_index];

    // Build the new item preserving time_block and day structure
    const swappedItem = {
      title: new_item.title,
      description: new_item.description,
      time_block: oldItem.time_block, // Keep same time block
      location_area: new_item.location_text || new_item.area,
      duration_minutes: new_item.duration_minutes || oldItem.duration_minutes,
      cost_min: new_item.estimated_cost_min ?? oldItem.cost_min,
      cost_max: new_item.estimated_cost_max ?? oldItem.cost_max,
      kid_friendly: new_item.kid_friendly ?? oldItem.kid_friendly,
      food_related: new_item.food_related ?? oldItem.food_related,
      maps_query: new_item.maps_query || `${new_item.title} ${trip.destination}`,
      transit_tip: oldItem.transit_tip, // Keep existing transit tip
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
      return new Response(
        JSON.stringify({ error: "Failed to swap activity" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Optionally trigger verification for the new item
    if (auto_verify) {
      try {
        const authHeader = req.headers.get("Authorization");
        const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-place`, {
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
        
        if (!verifyResponse.ok) {
          console.warn("[activity-swap] Auto-verify failed, but swap completed");
        }
      } catch (e) {
        console.warn("[activity-swap] Auto-verify error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Replaced "${oldItem.title}" with "${swappedItem.title}"`,
        swapped_item: swappedItem,
        day_number,
        item_index,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[activity-swap] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
