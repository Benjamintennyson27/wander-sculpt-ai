import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface AuthSuccess {
  success: true;
  user: { id: string; email: string };
}

export interface AuthFailure {
  success: false;
  error: string;
  status: number;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Verifies the authorization header and returns the authenticated user.
 * Returns an error object if authentication fails.
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    return { success: false, error: "No authorization header provided", status: 401 };
  }
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  
  if (authError || !user) {
    return { success: false, error: "Invalid or expired token", status: 401 };
  }
  
  return { success: true, user: { id: user.id, email: user.email || "" } };
}

/**
 * Verifies that the authenticated user owns the specified trip.
 * Uses service role client to check ownership.
 */
export async function verifyTripOwnership(
  tripId: string,
  userId: string
): Promise<{ owned: boolean; trip?: Record<string, unknown>; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();
  
  if (tripError || !trip) {
    return { owned: false, error: "Trip not found" };
  }
  
  if (trip.user_id !== userId) {
    return { owned: false, error: "You do not have permission to access this trip" };
  }
  
  return { owned: true, trip };
}

/**
 * Creates an unauthorized response with CORS headers
 */
export function unauthorizedResponse(message: string, status: number = 401): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Creates a forbidden response with CORS headers
 */
export function forbiddenResponse(message: string = "Access denied"): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
