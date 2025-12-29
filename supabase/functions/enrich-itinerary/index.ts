import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ItineraryItem {
  id: string;
  title: string;
  location_area: string | null;
  description: string | null;
}

interface ExtractedFacts {
  verified_note: string | null;
  hours_text: string | null;
  price_text: string | null;
  closed_day_text: string | null;
  sources: SearchResult[];
}

// Extract structured facts from search snippets
function extractFactsFromResults(results: SearchResult[], placeName: string): ExtractedFacts {
  if (!results || results.length === 0) {
    return {
      verified_note: null,
      hours_text: null,
      price_text: null,
      closed_day_text: null,
      sources: []
    };
  }

  const allSnippets = results.map(r => r.snippet).join(' ').toLowerCase();
  
  // Extract hours (patterns like "9am-6pm", "open from", "timing:")
  let hours_text: string | null = null;
  const hoursPatterns = [
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi,
    /open(?:ing)?\s*(?:hours|time|timing)?:?\s*([^.]+)/gi,
    /timing:?\s*([^.]+)/gi,
  ];
  for (const pattern of hoursPatterns) {
    const match = allSnippets.match(pattern);
    if (match) {
      hours_text = match[0].slice(0, 100);
      break;
    }
  }

  // Extract price (patterns like "₹", "Rs", "INR", "entry fee")
  let price_text: string | null = null;
  const pricePatterns = [
    /(₹\s*\d+[^.]*)/gi,
    /(rs\.?\s*\d+[^.]*)/gi,
    /(inr\s*\d+[^.]*)/gi,
    /entry\s*fee:?\s*([^.]+)/gi,
    /ticket\s*(?:price)?:?\s*([^.]+₹[^.]+)/gi,
    /(free\s*entry)/gi,
  ];
  for (const pattern of pricePatterns) {
    const match = allSnippets.match(pattern);
    if (match) {
      price_text = match[0].slice(0, 100);
      break;
    }
  }

  // Extract closed days
  let closed_day_text: string | null = null;
  const closedPatterns = [
    /closed\s*(?:on)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
    /weekly\s*(?:off|closed|holiday):?\s*([^.]+)/gi,
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*closed/gi,
  ];
  for (const pattern of closedPatterns) {
    const match = allSnippets.match(pattern);
    if (match) {
      closed_day_text = match[0].slice(0, 80);
      break;
    }
  }

  // Generate a verified note from the best snippet
  let verified_note: string | null = null;
  if (results[0]?.snippet) {
    // Get first 2 sentences or first 200 chars
    const snippet = results[0].snippet;
    const sentences = snippet.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
      verified_note = sentences.slice(0, 2).join('. ').trim();
      if (verified_note.length > 200) {
        verified_note = verified_note.slice(0, 197) + '...';
      }
    }
  }

  return {
    verified_note,
    hours_text,
    price_text,
    closed_day_text,
    sources: results.slice(0, 3) // Top 3 sources
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header to pass to you-search
    const authHeader = req.headers.get('authorization');

    const { trip_id, option_id } = await req.json();

    if (!trip_id || !option_id) {
      return new Response(
        JSON.stringify({ error: 'trip_id and option_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Enriching itinerary for trip ${trip_id}, option ${option_id}`);

    // Fetch trip destination
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('destination')
      .eq('id', trip_id)
      .single();

    if (tripError || !trip) {
      console.error('Trip fetch error:', tripError);
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const destination = trip.destination;

    // Fetch itinerary and its items through the JSON days structure
    const { data: itinerary, error: itineraryError } = await supabase
      .from('itineraries')
      .select('id, days')
      .eq('id', option_id)
      .eq('trip_id', trip_id)
      .single();

    if (itineraryError || !itinerary) {
      console.error('Itinerary fetch error:', itineraryError);
      return new Response(
        JSON.stringify({ error: 'Itinerary not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse days JSON and extract items to enrich
    const days = itinerary.days as any[];
    const itemsToEnrich: { dayIdx: number; itemIdx: number; title: string; location_area: string | null }[] = [];

    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const day = days[dayIdx];
      const items = day.items || [];
      for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
        const item = items[itemIdx];
        // Skip free time or empty items
        if (item.title?.toLowerCase().includes('free time')) continue;
        if (!item.title) continue;
        
        itemsToEnrich.push({
          dayIdx,
          itemIdx,
          title: item.title,
          location_area: item.location_area || null
        });
      }
    }

    // Limit to first 10-12 items to control API costs
    const enrichLimit = 12;
    const itemsToProcess = itemsToEnrich.slice(0, enrichLimit);

    console.log(`Processing ${itemsToProcess.length} items for enrichment`);

    const enrichedItems: Array<{
      dayIdx: number;
      itemIdx: number;
      facts: ExtractedFacts;
    }> = [];

    // Process items sequentially to respect rate limits
    for (const item of itemsToProcess) {
      try {
        // Build search query
        const locationPart = item.location_area ? ` ${item.location_area}` : '';
        const query = `${destination}${locationPart} ${item.title} opening hours ticket price closed day best time to visit`;

        console.log(`Searching for: ${item.title}`);

        // Call you-search function
        const searchResponse = await fetch(`${supabaseUrl}/functions/v1/you-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader || `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ query })
        });

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error(`Search failed for "${item.title}":`, errorText);
          
          // If rate limited, stop processing
          if (searchResponse.status === 429) {
            console.log('Rate limit hit, stopping enrichment');
            break;
          }
          continue;
        }

        const searchData = await searchResponse.json();
        const results = searchData.results || [];

        // Extract facts from search results
        const facts = extractFactsFromResults(results, item.title);

        enrichedItems.push({
          dayIdx: item.dayIdx,
          itemIdx: item.itemIdx,
          facts
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error enriching item "${item.title}":`, error);
      }
    }

    // Update the itinerary days JSON with enriched data
    const updatedDays = [...days];
    
    for (const enriched of enrichedItems) {
      const day = updatedDays[enriched.dayIdx];
      if (day && day.items && day.items[enriched.itemIdx]) {
        day.items[enriched.itemIdx].verified_facts = enriched.facts;
      }
    }

    // Save updated days back to itinerary
    const { error: updateError } = await supabase
      .from('itineraries')
      .update({ days: updatedDays })
      .eq('id', option_id);

    if (updateError) {
      console.error('Failed to update itinerary:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save enriched data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully enriched ${enrichedItems.length} items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        enriched_count: enrichedItems.length,
        total_items: itemsToEnrich.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('enrich-itinerary error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
