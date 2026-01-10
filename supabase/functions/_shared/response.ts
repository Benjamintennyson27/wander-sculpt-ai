import { corsHeaders } from "./auth.ts";

/**
 * Create a JSON success response with CORS headers
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    { 
      status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  message: string, 
  status = 500, 
  details?: unknown
): Response {
  const body: Record<string, unknown> = { error: message };
  if (details) body.details = details;
  
  return new Response(
    JSON.stringify(body),
    { 
      status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

/**
 * Create a bad request response
 */
export function badRequest(message: string, details?: unknown): Response {
  return errorResponse(message, 400, details);
}

/**
 * Create a not found response
 */
export function notFound(message = "Resource not found"): Response {
  return errorResponse(message, 404);
}

/**
 * Create an internal server error response
 */
export function serverError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[serverError]", error);
  return errorResponse(message, 500);
}

/**
 * Handle CORS preflight request
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
