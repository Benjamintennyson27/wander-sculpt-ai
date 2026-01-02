import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ItineraryItem {
  id: string;
  title: string;
  location_area: string | null;
}

// Items to skip (not real places)
const SKIP_PATTERNS = [
  /^free time$/i,
  /^rest$/i,
  /^sleep$/i,
  /^check.?in$/i,
  /^check.?out$/i,
  /^departure$/i,
  /^arrival$/i,
  /^travel to/i,
  /^drive to/i,
  /^flight/i,
  /^train/i,
  /^bus/i,
  /^taxi/i,
  /^uber/i,
  /^transfer/i,
  /^pack/i,
  /^relax/i,
  /^leisure/i,
  /^at leisure/i,
  /^own arrangements/i,
];

function shouldSkipItem(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 3) return true;
  return SKIP_PATTERNS.some(pattern => pattern.test(trimmed));
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tripId } = await req.json();

    if (!tripId) {
      return new Response(
        JSON.stringify({ error: 'tripId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting batch verification for trip: ${tripId}`);

    // Get trip details for location context
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('destination')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      console.error('Trip fetch error:', tripError);
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse destination (format: "City, State, Country" or "City, Country")
    const destParts = trip.destination.split(',').map((s: string) => s.trim());
    const city = destParts[0] || '';
    const country = destParts[destParts.length - 1] || '';
    const state = destParts.length > 2 ? destParts[1] : undefined;

    // Get trip settings for verify mode
    const { data: settings } = await supabase
      .from('trip_settings')
      .select('verify_mode')
      .eq('trip_id', tripId)
      .single();

    const verifyMode = settings?.verify_mode || 'balanced';

    // Get all itineraries for this trip
    const { data: itineraries, error: itinError } = await supabase
      .from('itineraries')
      .select('id, days')
      .eq('trip_id', tripId);

    if (itinError) {
      console.error('Itineraries fetch error:', itinError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch itineraries' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract all items from all itineraries
    const items: ItineraryItem[] = [];
    for (const itinerary of itineraries || []) {
      const days = itinerary.days as any[] || [];
      for (const day of days) {
        const dayItems = day.items || [];
        for (let itemIdx = 0; itemIdx < dayItems.length; itemIdx++) {
          const item = dayItems[itemIdx];
          if (item.title && !shouldSkipItem(item.title)) {
            // Generate a stable ID from itinerary + day + item index if not present
            const itemId = item.id || `${itinerary.id}-d${day.day || 0}-i${itemIdx}`;
            items.push({
              id: itemId,
              title: item.title,
              location_area: item.location_area || null,
            });
          }
        }
      }
    }

    console.log(`Found ${items.length} items to verify`);

    // Check which items already have verifications
    const { data: existingVerifications } = await supabase
      .from('place_verifications')
      .select('itinerary_item_id')
      .eq('trip_id', tripId);

    const verifiedIds = new Set((existingVerifications || []).map(v => v.itinerary_item_id));
    const itemsToVerify = items.filter(item => !verifiedIds.has(item.id));

    console.log(`${itemsToVerify.length} items need verification (${verifiedIds.size} already done)`);

    // Batch verify with rate limiting
    const results = {
      verified: 0,
      partial: 0,
      unverified: 0,
      failed: 0,
      skipped: verifiedIds.size,
    };

    const BATCH_SIZE = 3;
    const DELAY_BETWEEN_BATCHES = 1000; // 1 second

    for (let i = 0; i < itemsToVerify.length; i += BATCH_SIZE) {
      const batch = itemsToVerify.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (item) => {
        try {
          // Call verify-place function
          const response = await fetch(`${supabaseUrl}/functions/v1/verify-place`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              tripId,
              itineraryItemId: item.id,
              placeText: item.title,
              city,
              state,
              country,
              mode: verifyMode,
            }),
          });

          if (!response.ok) {
            console.error(`Verification failed for ${item.title}:`, await response.text());
            results.failed++;
            return;
          }

          const result = await response.json();
          results[result.status as keyof typeof results]++;
          console.log(`Verified "${item.title}": ${result.status} (${result.quality_score})`);
        } catch (error) {
          console.error(`Error verifying ${item.title}:`, error);
          results.failed++;
        }
      });

      await Promise.all(batchPromises);
      
      // Delay between batches to avoid rate limits
      if (i + BATCH_SIZE < itemsToVerify.length) {
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log(`Batch verification complete:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        total: items.length,
        processed: itemsToVerify.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('verify-trip-places error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
