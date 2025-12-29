import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for cache key
function hashQuery(query: string): string {
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface NormalizedResponse {
  results: SearchResult[];
  cached: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOU_API_KEY = Deno.env.get('YOU_API_KEY');
    
    if (!YOU_API_KEY) {
      console.error('YOU_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'YOU_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header for rate limiting
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const queryHash = hashQuery(query.toLowerCase().trim());
    console.log(`Processing search query: "${query}" (hash: ${queryHash})`);

    // Check rate limit if user is authenticated (20 searches/day)
    if (userId) {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: rateLimit } = await supabase
        .from('you_search_rate_limits')
        .select('search_count')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (rateLimit && rateLimit.search_count >= 20) {
        console.log(`Rate limit exceeded for user ${userId}`);
        return new Response(
          JSON.stringify({ error: 'Daily search limit reached (20 searches/day)' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check cache first
    const { data: cached } = await supabase
      .from('you_search_cache')
      .select('results')
      .eq('query_hash', queryHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      console.log('Cache hit for query:', query);
      const response: NormalizedResponse = {
        results: cached.results as SearchResult[],
        cached: true
      };
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Cache miss, calling You.com API...');

    // Call You.com Search API (correct v1 endpoint)
    const youApiUrl = new URL('https://ydc-index.io/v1/search');
    youApiUrl.searchParams.set('query', query);
    youApiUrl.searchParams.set('count', '5');
    
    const youResponse = await fetch(youApiUrl.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': YOU_API_KEY,
      },
    });

    if (!youResponse.ok) {
      const errorText = await youResponse.text();
      console.error('You.com API error:', youResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Search API error', details: errorText }),
        { status: youResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const youData = await youResponse.json();
    console.log('You.com API response received');

    // Normalize response - extract top 5 results from v1 API format
    const results: SearchResult[] = [];
    
    // You.com v1 API returns results.web array
    const webResults = youData.results?.web || youData.hits || [];
    for (const item of webResults.slice(0, 5)) {
      const snippets = item.snippets || [];
      const title = item.title || '';
      const url = item.url || '';
      const description = item.description || '';
      
      if (title && url) {
        results.push({
          title,
          url,
          snippet: snippets[0] || description || ''
        });
      }
    }

    console.log(`Normalized ${results.length} search results`);

    // Cache results (24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('you_search_cache')
      .upsert({
        query_hash: queryHash,
        query: query,
        results: results,
        expires_at: expiresAt
      }, { onConflict: 'query_hash' });

    // Update rate limit for authenticated users
    if (userId) {
      const today = new Date().toISOString().split('T')[0];
      
      // Try to increment existing record
      const { data: existing } = await supabase
        .from('you_search_rate_limits')
        .select('id, search_count')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (existing) {
        await supabase
          .from('you_search_rate_limits')
          .update({ search_count: existing.search_count + 1 })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('you_search_rate_limits')
          .insert({ user_id: userId, date: today, search_count: 1 });
      }
    }

    const response: NormalizedResponse = {
      results,
      cached: false
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('you-search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
