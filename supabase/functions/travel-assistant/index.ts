import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LLAMA_API_URL = "https://api.oxlo.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a friendly and knowledgeable travel assistant. Your role is to help travelers with:

1. **Destination Information**: Share insights about places, best times to visit, weather, culture, and local customs.
2. **Travel Tips**: Offer practical advice on packing, budgeting, safety, and health precautions.
3. **Recommendations**: Suggest activities, restaurants, hidden gems, and must-see attractions.
4. **Trip Planning**: Help with itinerary ideas, transportation options, and accommodation tips.
5. **Travel Concerns**: Address common worries about visas, language barriers, currency, and more.

Guidelines:
- Be concise but helpful. Keep responses under 200 words unless more detail is needed.
- Use a warm, encouraging tone to make travel feel exciting and accessible.
- When you don't know something specific, acknowledge it and offer general guidance.
- Format responses with bullet points or short paragraphs for easy reading.
- If asked about specific bookings or reservations, remind users you can provide advice but not make actual bookings.

Remember: You're here to make travel planning easier and more enjoyable!`;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json() as { messages: ChatMessage[] };
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LLAMA_API_KEY = Deno.env.get("LLAMA_API_KEY");
    if (!LLAMA_API_KEY) {
      console.error("LLAMA_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(LLAMA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLAMA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.1-8B-Instruct",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: false, // Oxlo API doesn't support streaming yet
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "I'm a bit busy right now. Please try again in a moment!" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to get AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Travel assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
