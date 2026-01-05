import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyAuth, verifyTripOwnership, corsHeaders, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";

// Input validation schema
const RequestSchema = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(2).max(200),
  tripType: z.string().max(50).optional(),
  foodPreference: z.string().max(50).optional(),
  interests: z.array(z.string().max(100)).max(20).optional(),
});

interface Attraction {
  name: string;
  type: string;
  area: string;
  reason: string;
  maps_query: string;
  source_url?: string;
}

interface FoodSpot {
  name: string;
  area: string;
  cuisine_type: string;
  maps_query: string;
  source_url?: string;
}

interface EnrichmentResult {
  attractions: Attraction[];
  food_spots: FoodSpot[];
}

async function fetchWithYouSearch(query: string): Promise<{ results: { title: string; snippet: string; url: string }[] }> {
  const youApiKey = Deno.env.get('YOU_API_KEY');
  
  if (!youApiKey) {
    console.log('[enrich-destination] No YOU_API_KEY found, using AI-only enrichment');
    return { results: [] };
  }

  try {
    const response = await fetch(`https://api.ydc-index.io/search?query=${encodeURIComponent(query)}`, {
      headers: {
        'X-API-Key': youApiKey,
      },
    });

    if (!response.ok) {
      console.error('[enrich-destination] You.com API error:', response.status, await response.text());
      return { results: [] };
    }

    const data = await response.json();
    return {
      results: (data.hits || []).slice(0, 10).map((hit: { title: string; description: string; url: string }) => ({
        title: hit.title || '',
        snippet: hit.description || '',
        url: hit.url || '',
      })),
    };
  } catch (error) {
    console.error('[enrich-destination] You.com search failed:', error);
    return { results: [] };
  }
}

async function enrichWithAI(
  destination: string,
  tripType: string,
  foodPreference: string,
  interests: string[],
  webContext: string
): Promise<EnrichmentResult> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  const interestsStr = interests.length > 0 ? interests.join(', ') : 'general sightseeing';
  
  const prompt = `You are a travel research assistant with access to real destination data.
Based on the following web search results and your knowledge, provide FACTUAL travel recommendations for ${destination}.

WEB SEARCH CONTEXT:
${webContext || 'No web search results available. Use your knowledge of real, verified places.'}

REQUIREMENTS:
- Trip type: ${tripType}
- Food preference: ${foodPreference}
- Interests: ${interestsStr}

IMPORTANT RULES:
1. Only include REAL places that actually exist in ${destination}
2. Provide accurate location areas/neighborhoods
3. Include a Google Maps search query for each place
4. For attractions, categorize by type (temple, beach, museum, nature, market, etc.)
5. For food spots, include cuisine type and whether it's street food or restaurant

Return ONLY valid JSON with this EXACT structure:
{
  "attractions": [
    {
      "name": "Exact Place Name",
      "type": "temple|beach|museum|park|market|historic|nature|adventure|entertainment",
      "area": "Neighborhood/Area Name",
      "reason": "Brief 1-line reason why it's good (e.g., 'Family-friendly with interactive exhibits')",
      "maps_query": "Place Name, ${destination}"
    }
  ],
  "food_spots": [
    {
      "name": "Restaurant/Market Name or Area Description",
      "area": "Neighborhood/Area",
      "cuisine_type": "local|street-food|multi-cuisine|vegetarian|seafood|etc",
      "maps_query": "Place Name, ${destination}"
    }
  ]
}

Provide:
- 12-15 attractions (mix of types matching interests)
- 8-10 food spots (matching food preference)

CRITICAL: Only include places you're confident actually exist. No made-up names.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a travel research assistant. Return ONLY valid JSON, no markdown code blocks.' },
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[enrich-destination] AI error:', errText);
    throw new Error('AI enrichment failed');
  }

  const aiData = await response.json();
  let content = aiData.choices?.[0]?.message?.content || '';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    const parsed = JSON.parse(content);
    
    // Validate structure
    if (!Array.isArray(parsed.attractions)) {
      parsed.attractions = [];
    }
    if (!Array.isArray(parsed.food_spots)) {
      parsed.food_spots = [];
    }
    
    // Ensure maps_query exists for each item
    parsed.attractions = parsed.attractions.map((a: Attraction) => ({
      ...a,
      maps_query: a.maps_query || `${a.name}, ${destination}`,
    }));
    parsed.food_spots = parsed.food_spots.map((f: FoodSpot) => ({
      ...f,
      maps_query: f.maps_query || `${f.name}, ${destination}`,
    }));
    
    return parsed;
  } catch (e) {
    console.error('[enrich-destination] Parse error:', e, content.substring(0, 500));
    throw new Error('Invalid AI response format');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.success) {
      console.log('[enrich-destination] Auth failed:', authResult.error);
      return unauthorizedResponse(authResult.error, authResult.status);
    }
    
    const userId = authResult.user.id;
    console.log('[enrich-destination] Authenticated user:', userId);

    // 2. Parse and validate input
    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.log('[enrich-destination] Validation failed:', parseResult.error.issues);
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { tripId, destination, tripType = 'mixed', foodPreference = 'mixed', interests = [] } = parseResult.data;

    // 3. Verify trip ownership
    const ownershipResult = await verifyTripOwnership(tripId, userId);
    if (!ownershipResult.owned) {
      console.log('[enrich-destination] Ownership check failed:', ownershipResult.error);
      return forbiddenResponse(ownershipResult.error);
    }
    
    console.log(`[enrich-destination] Starting enrichment for ${destination}, trip ${tripId}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if we already have recent facts for this trip
    const { data: existingFacts } = await supabase
      .from('destination_facts')
      .select('*')
      .eq('trip_id', tripId)
      .single();

    if (existingFacts) {
      console.log(`[enrich-destination] Using cached facts for trip ${tripId}`);
      return new Response(JSON.stringify({
        success: true,
        cached: true,
        attractions: existingFacts.attractions,
        food_spots: existingFacts.food_spots,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch web context using You.com API
    const searchQueries = [
      `top tourist attractions ${destination} India`,
      `best places to visit ${destination} ${tripType === 'family' ? 'with kids family' : ''}`,
      `best ${foodPreference} food ${destination}`,
    ];

    console.log(`[enrich-destination] Running ${searchQueries.length} web searches...`);
    
    const searchPromises = searchQueries.map(q => fetchWithYouSearch(q));
    const searchResults = await Promise.all(searchPromises);
    
    // Combine all search results into context
    const webContext = searchResults
      .flatMap(r => r.results)
      .map(r => `- ${r.title}: ${r.snippet}`)
      .join('\n');

    console.log(`[enrich-destination] Web context gathered: ${webContext.length} chars`);

    // Call AI to extract structured facts
    const enrichedData = await enrichWithAI(
      destination,
      tripType,
      foodPreference,
      interests,
      webContext
    );

    console.log(`[enrich-destination] Got ${enrichedData.attractions.length} attractions, ${enrichedData.food_spots.length} food spots`);

    // Save to database
    const { error: insertError } = await supabase
      .from('destination_facts')
      .insert({
        trip_id: tripId,
        destination,
        trip_type: tripType,
        food_preference: foodPreference,
        attractions: enrichedData.attractions,
        food_spots: enrichedData.food_spots,
        model_used: 'google/gemini-2.5-flash',
        raw_response: { webContext: webContext.substring(0, 5000) },
      });

    if (insertError) {
      console.error('[enrich-destination] DB insert error:', insertError);
      // Continue anyway, facts are still usable
    }

    return new Response(JSON.stringify({
      success: true,
      cached: false,
      attractions: enrichedData.attractions,
      food_spots: enrichedData.food_spots,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[enrich-destination] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
