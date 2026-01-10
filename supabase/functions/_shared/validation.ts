import { z, ZodSchema, ZodError } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { badRequest } from "./response.ts";

/**
 * Common validation schemas
 */
export const schemas = {
  uuid: z.string().uuid(),
  tripId: z.string().uuid(),
  positiveInt: z.number().int().min(0),
  dayNumber: z.number().int().min(1).max(30),
  itemIndex: z.number().int().min(0).max(50),
};

/**
 * Validate request body against a Zod schema
 * Returns validated data or throws
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: Response }> {
  try {
    const rawBody = await req.json();
    const data = schema.parse(rawBody);
    return { data, error: null };
  } catch (e) {
    if (e instanceof ZodError) {
      return { 
        data: null, 
        error: badRequest("Invalid input", e.issues) 
      };
    }
    return { 
      data: null, 
      error: badRequest("Invalid JSON body") 
    };
  }
}

/**
 * Sanitize string input - trim and limit length
 */
export function sanitizeString(
  value: unknown, 
  maxLength = 500, 
  defaultValue = ""
): string {
  if (typeof value !== "string") return defaultValue;
  return value.trim().slice(0, maxLength);
}

/**
 * Sanitize number input with bounds
 */
export function sanitizeNumber(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  defaultValue = 0
): number {
  const num = Number(value);
  if (isNaN(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

/**
 * Sanitize boolean input
 */
export function sanitizeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === "boolean") return value;
  return defaultValue;
}

// Re-export zod for convenience
export { z, ZodError } from "https://deno.land/x/zod@v3.22.4/mod.ts";
