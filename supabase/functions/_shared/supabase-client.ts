import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let _serviceClient: SupabaseClient | null = null;

/**
 * Get a Supabase client with service role key for admin operations
 */
export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  
  _serviceClient = createClient(url, key);
  return _serviceClient;
}

/**
 * Create a user-context Supabase client from an authorization header
 */
export function getUserClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

/**
 * Get environment variables with validation
 */
export function getEnv(key: string, required = true): string {
  const value = Deno.env.get(key);
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

/**
 * Helper to get the Supabase URL
 */
export function getSupabaseUrl(): string {
  return getEnv("SUPABASE_URL");
}
