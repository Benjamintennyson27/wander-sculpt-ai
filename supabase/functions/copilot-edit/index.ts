import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyAuth, verifyTripOwnership, corsHeaders, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";
import { getServiceClient } from "../_shared/supabase-client.ts";
import { callAI, parseAIJson, getAIErrorStatus } from "../_shared/ai-client.ts";
import { handleCors, jsonResponse, errorResponse, badRequest } from "../_shared/response.ts";
import { validateBody, sanitizeString, sanitizeNumber } from "../_shared/validation.ts";

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
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error, authResult.status);
    }
    
    const userId = authResult.user.id;

    // 2. Validate input
    const { data: input, error: validationError } = await validateBody(req, RequestSchema);
    if (validationError) return validationError;
    
    const { trip_id, user_message } = input;

    // 3. Verify trip ownership
    const ownershipResult = await verifyTripOwnership(trip_id, userId);
    if (!ownershipResult.owned) {
      return forbiddenResponse(ownershipResult.error);
    }
    
    const trip = ownershipResult.trip!;
    const supabase = getServiceClient();

    // Get selected itinerary
    const itineraryId = trip.selected_itinerary_id;
    if (!itineraryId) {
      return badRequest("No itinerary selected for this trip");
    }

    const { data: itinerary, error: itinError } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", itineraryId)
      .single();

    if (itinError || !itinerary) {
      return errorResponse(`Itinerary not found: ${itinError?.message}`, 404);
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

    // Get chat history
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

    // Build AI prompt
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
  }))
})), null, 2)}

Trip preferences:
- Budget: ₹${trip.budget_inr}
- Is family trip: ${trip.is_family}
- Food preference: ${trip.food_pref || 'Not specified'}
- Interests: ${JSON.stringify(trip.interests || [])}

Respond with a JSON object containing:
{
  "operations": [{ action, day_number, item_index, slot, new_item, updates }],
  "summary": "Brief description of changes made",
  "affected_days": [1, 2]
}

Available actions:
- replace_item: { action: "replace_item", day_number: 1, item_index: 0, new_item: {...} }
- add_item: { action: "add_item", day_number: 1, slot: "evening", new_item: {...} }
- remove_item: { action: "remove_item", day_number: 1, item_index: 0 }
- rewrite_item_text: { action: "rewrite_item_text", day_number: 1, item_index: 0, updates: { title?, description? } }
- update_day_pace: { action: "update_day_pace", day_number: 1, updates: { notes?, title? } }`;

    // Call AI
    const aiResponse = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory.slice(-6),
        { role: "user", content: user_message }
      ],
      jsonResponse: true,
    });

    const editPlan = parseAIJson<EditPlan>(aiResponse.content, { operations: [], summary: "", affected_days: [] });

    // Apply operations
    const updatedDays = [...days];
    const changes: string[] = [];

    for (const op of editPlan.operations || []) {
      const dayIdx = (op.day_number || 1) - 1;
      if (dayIdx < 0 || dayIdx >= updatedDays.length) continue;

      const day = updatedDays[dayIdx];
      const items = day.items || [];

      switch (op.action) {
        case 'replace_item':
          if (op.item_index !== undefined && op.item_index < items.length && op.new_item) {
            const newItem = {
              ...items[op.item_index],
              title: sanitizeString(op.new_item.title, 200, items[op.item_index].title),
              description: sanitizeString(op.new_item.description, 1000),
              location_area: sanitizeString(op.new_item.location_area, 200),
              maps_query: sanitizeString(op.new_item.maps_query, 300),
            };
            const oldTitle = items[op.item_index].title;
            items[op.item_index] = newItem;
            changes.push(`Replaced "${oldTitle}" with "${newItem.title}"`);
          }
          break;

        case 'add_item':
          if (op.new_item) {
            const newItem = {
              title: sanitizeString(op.new_item.title, 200, 'New Activity'),
              description: sanitizeString(op.new_item.description, 1000),
              time_block: op.slot || op.new_item.time_block || 'afternoon',
              location_area: sanitizeString(op.new_item.location_area, 200),
              maps_query: sanitizeString(op.new_item.maps_query, 300),
              duration_minutes: sanitizeNumber(op.new_item.duration_minutes, 0, 1440, 60),
              cost_min: sanitizeNumber(op.new_item.cost_min, 0, 10000000),
              cost_max: sanitizeNumber(op.new_item.cost_max, 0, 10000000),
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
            if (op.updates.title) updates.title = sanitizeString(op.updates.title, 200);
            if (op.updates.description) updates.description = sanitizeString(op.updates.description, 1000);
            if (op.updates.transit_tip) updates.transit_tip = sanitizeString(op.updates.transit_tip, 500);
            items[op.item_index] = { ...items[op.item_index], ...updates };
            changes.push(`Updated "${items[op.item_index].title}"`);
          }
          break;

        case 'update_day_pace':
          if (op.updates) {
            const updates: Record<string, unknown> = {};
            if (op.updates.notes) updates.notes = sanitizeString(op.updates.notes, 500);
            if (op.updates.title) updates.title = sanitizeString(op.updates.title, 200);
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

      if (updateError) throw new Error("Failed to apply changes");

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
      : "I understood your request but couldn't find specific changes to make. Could you be more specific?";

    // Save assistant message
    await supabase.from("trip_chat_messages").insert({
      thread_id: threadId,
      role: "assistant",
      content: assistantMessage,
    });

    return jsonResponse({
      success: true,
      message: assistantMessage,
      changes,
      affected_days: editPlan.affected_days || [],
    });

  } catch (error) {
    console.error("[copilot-edit] Error:", error);
    const status = getAIErrorStatus(error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error", status);
  }
});