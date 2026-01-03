import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trip_id, day_number, item_index, new_item, auto_verify } = await req.json();
    
    if (!trip_id || day_number === undefined || item_index === undefined || !new_item) {
      return new Response(
        JSON.stringify({ error: "trip_id, day_number, item_index, and new_item are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Get selected itinerary
    const itineraryId = trip.selected_itinerary_id;
    if (!itineraryId) {
      throw new Error("No itinerary selected for this trip");
    }

    const { data: itinerary, error: itinError } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", itineraryId)
      .single();

    if (itinError || !itinerary) {
      throw new Error(`Itinerary not found: ${itinError?.message}`);
    }

    const days = [...(itinerary.days || [])];
    const dayIdx = day_number - 1;
    
    if (dayIdx < 0 || dayIdx >= days.length) {
      throw new Error(`Invalid day number: ${day_number}`);
    }

    const day = days[dayIdx];
    const items = [...(day.items || [])];
    
    if (item_index < 0 || item_index >= items.length) {
      throw new Error(`Invalid item index: ${item_index}`);
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
      .eq("id", itineraryId);

    if (updateError) {
      console.error("Failed to update itinerary:", updateError);
      throw new Error("Failed to swap activity");
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
        // Call verify-place for just this item
        const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-place`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trip_id,
            itinerary_item_id: `${itineraryId}-d${day_number}-i${item_index}`,
            query: swappedItem.maps_query || swappedItem.title,
            destination: trip.destination,
          }),
        });
        
        if (!verifyResponse.ok) {
          console.warn("Auto-verify failed, but swap completed");
        }
      } catch (e) {
        console.warn("Auto-verify error:", e);
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
    console.error("Swap error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
