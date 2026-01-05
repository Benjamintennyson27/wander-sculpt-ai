import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyAuth, verifyTripOwnership, corsHeaders, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

// Input validation schema
const RequestSchema = z.object({
  trip_id: z.string().uuid(),
  option_id: z.string().optional(),
  user_message: z.string().min(1).max(2000),
});

interface EditOperation {
  action: 'replace_item' | 'add_item' | 'remove_item' | 'reorder_items' | 'rewrite_item_text' | 'update_day_pace';
  day_number?: number;
  item_index?: number;
  slot?: string;
  new_item?: Record<string, unknown>;
  updates?: Record<string, unknown>;
  ordered_indices?: number[];
}

interface EditPlan {
  operations: EditOperation[];
  summary: string;
  affected_days: number[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.success) {
      console.log('[copilot-edit] Auth failed:', authResult.error);
      return unauthorizedResponse(authResult.error, authResult.status);
    }
    
    const userId = authResult.user.id;
    console.log('[copilot-edit] Authenticated user:', userId);

    // 2. Parse and validate input
    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.log('[copilot-edit] Validation failed:', parseResult.error.issues);
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { trip_id, user_message } = parseResult.data;

    // 3. Verify trip ownership
    const ownershipResult = await verifyTripOwnership(trip_id, userId);
    if (!ownershipResult.owned) {
      console.log('[copilot-edit] Ownership check failed:', ownershipResult.error);
      return forbiddenResponse(ownershipResult.error);
    }
    
    const trip = ownershipResult.trip!;
    console.log('[copilot-edit] Trip ownership verified for:', trip_id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get selected itinerary
    const itineraryId = trip.selected_itinerary_id;
    if (!itineraryId) {
      return new Response(
        JSON.stringify({ error: "No itinerary selected for this trip" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: itinerary, error: itinError } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", itineraryId)
      .single();

    if (itinError || !itinerary) {
      return new Response(
        JSON.stringify({ error: `Itinerary not found: ${itinError?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const days = itinerary.days || [];
    
    // Get or create chat thread
    let threadId: string;
    const { data: existingThread } = await supabase
      .from("trip_chat_threads")
      .select("id")
      .eq("trip_id", trip_id)
      .eq("user_id", trip.user_id)
      .single();

    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const { data: newThread, error: threadError } = await supabase
        .from("trip_chat_threads")
        .insert({ trip_id, user_id: trip.user_id })
        .select("id")
        .single();
      
      if (threadError) throw new Error(`Failed to create thread: ${threadError.message}`);
      threadId = newThread.id;
    }

    // Save user message
    await supabase.from("trip_chat_messages").insert({
      thread_id: threadId,
      role: "user",
      content: user_message,
    });

    // Get chat history for context
    const { data: history } = await supabase
      .from("trip_chat_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(10);

    const chatHistory = history?.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    })) || [];

    // Build context for AI
    const systemPrompt = `You are a travel itinerary copilot. The user has a trip to ${trip.destination} with ${days.length} days.

Current itinerary structure:
${JSON.stringify(days.map((d: Record<string, unknown>, idx: number) => ({
  day: d.day || idx + 1,
  title: d.title,
  items: ((d.items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>, itemIdx: number) => ({
    index: itemIdx,
    title: item.title,
    time_block: item.time_block,
    location_area: item.location_area,
    description: String(item.description || '').slice(0, 100),
    cost_min: item.cost_min,
    cost_max: item.cost_max,
  }))
})), null, 2)}

Trip preferences:
- Budget: ₹${trip.budget_inr}
- Is family trip: ${trip.is_family}
- Food preference: ${trip.food_pref || 'Not specified'}
- Pace: ${trip.pace || 'moderate'}
- Interests: ${JSON.stringify(trip.interests || [])}

Your task: Based on the user's request, create an edit plan in JSON format.

IMPORTANT RULES:
1. Only make changes the user explicitly asks for
2. Keep existing structure intact unless asked to change
3. Preserve costs and durations if not mentioned
4. Use valid time_blocks: morning, afternoon, evening, night
5. Match the destination and local culture

Respond with a JSON object containing:
{
  "operations": [
    // Array of operations to perform
    // Each operation has: action, day_number, item_index, slot, new_item, updates
  ],
  "summary": "Brief description of changes made",
  "affected_days": [1, 2] // Array of day numbers affected
}

Available actions:
- replace_item: { action: "replace_item", day_number: 1, item_index: 0, new_item: {...} }
- add_item: { action: "add_item", day_number: 1, slot: "evening", new_item: {...} }
- remove_item: { action: "remove_item", day_number: 1, item_index: 0 }
- rewrite_item_text: { action: "rewrite_item_text", day_number: 1, item_index: 0, updates: { title?, description?, transit_tip? } }
- update_day_pace: { action: "update_day_pace", day_number: 1, updates: { notes?, title? } }

Item structure:
{
  title: string,
  description: string,
  time_block: "morning" | "afternoon" | "evening" | "night",
  location_area: string,
  duration_minutes: number,
  cost_min: number,
  cost_max: number,
  kid_friendly: boolean,
  food_related: boolean,
  transit_tip?: string,
  maps_query: string // for Google Maps search
}`;

    // Call AI
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
          ...chatHistory.slice(-6),
          { role: "user", content: user_message }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[copilot-edit] AI API error:", aiResponse.status, errorText);
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
    
    console.log("[copilot-edit] AI response received");

    let editPlan: EditPlan;
    try {
      editPlan = JSON.parse(responseText);
    } catch (e) {
      console.error("[copilot-edit] Failed to parse AI response:", e);
      throw new Error("Failed to parse edit plan from AI");
    }

    // Validate and apply operations
    const updatedDays = [...days];
    const changes: string[] = [];

    for (const op of editPlan.operations || []) {
      const dayIdx = (op.day_number || 1) - 1;
      
      if (dayIdx < 0 || dayIdx >= updatedDays.length) {
        console.warn(`[copilot-edit] Invalid day number: ${op.day_number}`);
        continue;
      }

      const day = updatedDays[dayIdx];
      const items = day.items || [];

      switch (op.action) {
        case 'replace_item':
          if (op.item_index !== undefined && op.item_index < items.length && op.new_item) {
            // Validate new_item fields
            const newItem = {
              ...items[op.item_index],
              title: String(op.new_item.title || items[op.item_index].title).slice(0, 200),
              description: String(op.new_item.description || '').slice(0, 1000),
              location_area: String(op.new_item.location_area || '').slice(0, 200),
              maps_query: String(op.new_item.maps_query || '').slice(0, 300),
            };
            const oldTitle = items[op.item_index].title;
            items[op.item_index] = newItem;
            changes.push(`Replaced "${oldTitle}" with "${newItem.title}"`);
          }
          break;

        case 'add_item':
          if (op.new_item) {
            const newItem = {
              title: String(op.new_item.title || 'New Activity').slice(0, 200),
              description: String(op.new_item.description || '').slice(0, 1000),
              time_block: op.slot || op.new_item.time_block || 'afternoon',
              location_area: String(op.new_item.location_area || '').slice(0, 200),
              maps_query: String(op.new_item.maps_query || '').slice(0, 300),
              duration_minutes: Math.min(1440, Number(op.new_item.duration_minutes) || 60),
              cost_min: Math.min(10000000, Number(op.new_item.cost_min) || 0),
              cost_max: Math.min(10000000, Number(op.new_item.cost_max) || 0),
            };
            items.push(newItem);
            changes.push(`Added "${newItem.title}" to Day ${op.day_number}`);
          }
          break;

        case 'remove_item':
          if (op.item_index !== undefined && op.item_index < items.length) {
            const removed = items.splice(op.item_index, 1)[0];
            changes.push(`Removed "${removed.title}"`);
          }
          break;

        case 'rewrite_item_text':
          if (op.item_index !== undefined && op.item_index < items.length && op.updates) {
            const updates: Record<string, unknown> = {};
            if (op.updates.title) updates.title = String(op.updates.title).slice(0, 200);
            if (op.updates.description) updates.description = String(op.updates.description).slice(0, 1000);
            if (op.updates.transit_tip) updates.transit_tip = String(op.updates.transit_tip).slice(0, 500);
            items[op.item_index] = { ...items[op.item_index], ...updates };
            changes.push(`Updated "${items[op.item_index].title}"`);
          }
          break;

        case 'update_day_pace':
          if (op.updates) {
            const updates: Record<string, unknown> = {};
            if (op.updates.notes) updates.notes = String(op.updates.notes).slice(0, 500);
            if (op.updates.title) updates.title = String(op.updates.title).slice(0, 200);
            updatedDays[dayIdx] = { ...day, ...updates };
            changes.push(`Updated Day ${op.day_number} summary`);
          }
          break;
      }

      updatedDays[dayIdx] = { ...day, items };
    }

    // Update itinerary in database
    if (changes.length > 0) {
      const { error: updateError } = await supabase
        .from("itineraries")
        .update({ days: updatedDays })
        .eq("id", itineraryId);

      if (updateError) {
        console.error("[copilot-edit] Failed to update itinerary:", updateError);
        throw new Error("Failed to apply changes");
      }

      // Log the edit
      await supabase.from("itinerary_edits_log").insert({
        trip_id,
        option_id: itinerary.option_label || 'A',
        action: editPlan.operations?.[0]?.action || 'edit',
        payload: { operations: editPlan.operations, changes },
      });
    }

    // Generate assistant response
    const assistantMessage = changes.length > 0
      ? `✅ ${editPlan.summary || 'Changes applied!'}\n\n${changes.map(c => `• ${c}`).join('\n')}`
      : "I understood your request but couldn't find specific changes to make. Could you be more specific about what you'd like to modify?";

    // Save assistant message
    await supabase.from("trip_chat_messages").insert({
      thread_id: threadId,
      role: "assistant",
      content: assistantMessage,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: assistantMessage,
        changes,
        affected_days: editPlan.affected_days || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[copilot-edit] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
