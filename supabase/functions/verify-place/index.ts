import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPlaceRequest {
  tripId: string;
  itineraryItemId: string;
  placeText: string;
  city: string;
  state?: string;
  country: string;
  mode?: 'fast' | 'balanced' | 'strict';
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface VerificationResult {
  status: 'verified' | 'partial' | 'unverified' | 'failed';
  quality_score: number;
  best_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  sources: { title: string; url: string; snippet: string }[];
  reasoning: string;
}

// Extract coordinates from various URL formats
function extractCoordinates(text: string): { lat: number; lng: number } | null {
  // Google Maps patterns
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,  // @lat,lng format
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // ll=lat,lng format
    /q=(-?\d+\.\d+),(-?\d+\.\d+)/,  // q=lat,lng format
    /place\/[^\/]+\/(-?\d+\.\d+),(-?\d+\.\d+)/, // place format
    /maps\?.*?&ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // maps?...ll= format
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }
  
  return null;
}

// Extract address from snippet
function extractAddress(snippets: string[]): string | null {
  for (const snippet of snippets) {
    // Look for address-like patterns
    const addressPatterns = [
      /(?:located at|address[:\s]+|find us at)\s*([^.]+)/i,
      /(\d+[^,]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})/i, // US address
      /(\d+[^,]+,\s*[A-Za-z\s]+,\s*[A-Za-z\s]+\d{6})/i, // Indian pincode
    ];
    
    for (const pattern of addressPatterns) {
      const match = snippet.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
  }
  return null;
}

async function searchYou(query: string, apiKey: string): Promise<SearchResult[]> {
  const youApiUrl = new URL('https://ydc-index.io/v1/search');
  youApiUrl.searchParams.set('query', query);
  youApiUrl.searchParams.set('count', '5');
  
  console.log(`Searching YOU API: ${query}`);
  
  const response = await fetch(youApiUrl.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
  });
  
  if (!response.ok) {
    console.error('YOU API error:', response.status, await response.text());
    return [];
  }
  
  const data = await response.json();
  const results: SearchResult[] = [];
  
  // Handle YOU.com API response format: results.web array
  const webResults = data.results?.web || [];
  for (const hit of webResults.slice(0, 5)) {
    results.push({
      title: hit.title || '',
      url: hit.url || '',
      snippet: hit.description || hit.snippet || '',
    });
  }
  
  return results;
}

function calculateQualityScore(
  results: SearchResult[],
  placeText: string,
  hasCoords: boolean,
  hasAddress: boolean
): { score: number; status: 'verified' | 'partial' | 'unverified'; reasoning: string } {
  if (results.length === 0) {
    return {
      score: 0,
      status: 'unverified',
      reasoning: 'No search results found for this place.',
    };
  }
  
  const placeWords = placeText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  let matchingResults = 0;
  let strongMatches = 0;
  
  for (const result of results) {
    const titleLower = result.title.toLowerCase();
    const snippetLower = result.snippet.toLowerCase();
    const combined = titleLower + ' ' + snippetLower;
    
    const matchedWords = placeWords.filter(word => combined.includes(word));
    if (matchedWords.length >= placeWords.length * 0.5) {
      matchingResults++;
    }
    if (matchedWords.length >= placeWords.length * 0.8) {
      strongMatches++;
    }
  }
  
  let score = 0;
  let reasons: string[] = [];
  
  // Base score from matching results
  score += Math.min(40, matchingResults * 10);
  if (matchingResults > 0) {
    reasons.push(`${matchingResults} matching sources found`);
  }
  
  // Bonus for strong matches
  score += Math.min(30, strongMatches * 15);
  if (strongMatches > 0) {
    reasons.push(`${strongMatches} strong title matches`);
  }
  
  // Bonus for coordinates
  if (hasCoords) {
    score += 20;
    reasons.push('coordinates extracted');
  }
  
  // Bonus for address
  if (hasAddress) {
    score += 10;
    reasons.push('address found');
  }
  
  // Determine status
  let status: 'verified' | 'partial' | 'unverified';
  if (score >= 80) {
    status = 'verified';
  } else if (score >= 50) {
    status = 'partial';
  } else {
    status = 'unverified';
  }
  
  return {
    score: Math.min(100, score),
    status,
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'Limited information available.',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOU_API_KEY = Deno.env.get('YOU_API_KEY');
    if (!YOU_API_KEY) {
      console.error('YOU_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Search API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: VerifyPlaceRequest = await req.json();
    const { tripId, itineraryItemId, placeText, city, state, country, mode = 'balanced' } = body;

    if (!tripId || !itineraryItemId || !placeText || !city || !country) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying place: "${placeText}" in ${city}, ${country}`);

    // Build search queries
    const locationStr = state ? `${city} ${state} ${country}` : `${city} ${country}`;
    const queries = [
      `${placeText} ${locationStr} official site`,
    ];
    
    // In balanced/strict mode, do additional search for maps/location
    if (mode !== 'fast') {
      queries.push(`${placeText} ${locationStr} location address`);
    }

    // Execute searches
    const allResults: SearchResult[] = [];
    for (const query of queries) {
      const results = await searchYou(query, YOU_API_KEY);
      allResults.push(...results);
    }

    // Deduplicate by URL
    const uniqueResults = allResults.filter((r, i, arr) => 
      arr.findIndex(x => x.url === r.url) === i
    ).slice(0, 8);

    // Try to extract coordinates
    let coords: { lat: number; lng: number } | null = null;
    for (const result of uniqueResults) {
      coords = extractCoordinates(result.url);
      if (coords) break;
      coords = extractCoordinates(result.snippet);
      if (coords) break;
    }

    // Try to extract address
    const snippets = uniqueResults.map(r => r.snippet);
    const address = extractAddress(snippets);

    // Find best name (use first strong match title or original)
    let bestName = placeText;
    for (const result of uniqueResults) {
      const placeWords = placeText.toLowerCase().split(/\s+/);
      const titleLower = result.title.toLowerCase();
      const matchCount = placeWords.filter(w => titleLower.includes(w)).length;
      if (matchCount >= placeWords.length * 0.5 && result.title.length > 3) {
        bestName = result.title.split('|')[0].split('-')[0].trim();
        break;
      }
    }

    // Calculate quality score
    const { score, status, reasoning } = calculateQualityScore(
      uniqueResults,
      placeText,
      coords !== null,
      address !== null
    );

    // Prepare sources (top 5)
    const sources = uniqueResults.slice(0, 5).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
    }));

    // Upsert verification result
    const verificationData = {
      trip_id: tripId,
      itinerary_item_id: itineraryItemId,
      query: placeText,
      status,
      quality_score: score,
      best_name: bestName,
      address,
      lat: coords?.lat || null,
      lng: coords?.lng || null,
      sources,
      reasoning,
    };

    const { error: upsertError } = await supabase
      .from('place_verifications')
      .upsert(verificationData, { 
        onConflict: 'trip_id,itinerary_item_id',
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save verification', details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have coords, also upsert to trip_places for map
    if (coords) {
      await supabase
        .from('trip_places')
        .upsert({
          trip_id: tripId,
          name: bestName,
          lat: coords.lat,
          lng: coords.lng,
          source: 'you_search',
          metadata: { itinerary_item_id: itineraryItemId },
        }, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });
    }

    console.log(`Verification complete: ${status} (score: ${score})`);

    const result: VerificationResult = {
      status,
      quality_score: score,
      best_name: bestName,
      address,
      lat: coords?.lat || null,
      lng: coords?.lng || null,
      sources,
      reasoning,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('verify-place error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
