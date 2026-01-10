import { getEnv } from "./supabase-client.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequestOptions {
  model?: string;
  messages: ChatMessage[];
  jsonResponse?: boolean;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  finishReason: string | null;
}

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Call Lovable AI Gateway with automatic error handling
 */
export async function callAI(options: AIRequestOptions): Promise<AIResponse> {
  const lovableApiKey = getEnv("LOVABLE_API_KEY");
  
  const body: Record<string, unknown> = {
    model: options.model || "google/gemini-2.5-flash",
    messages: options.messages,
  };
  
  if (options.jsonResponse) {
    body.response_format = { type: "json_object" };
  }
  
  if (options.maxTokens) {
    body.max_tokens = options.maxTokens;
  }
  
  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ai-client] API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new AIRateLimitError("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new AIPaymentError("Payment required. Please add credits to continue.");
    }
    throw new AIError(`AI API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const finishReason = data.choices?.[0]?.finish_reason || null;
  
  return { content, finishReason };
}

/**
 * Parse JSON from AI response with fallback
 */
export function parseAIJson<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T;
  } catch (e) {
    console.error("[ai-client] Failed to parse JSON:", e);
    return fallback;
  }
}

// Custom error classes
export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

export class AIRateLimitError extends AIError {
  constructor(message: string) {
    super(message);
    this.name = "AIRateLimitError";
  }
}

export class AIPaymentError extends AIError {
  constructor(message: string) {
    super(message);
    this.name = "AIPaymentError";
  }
}

/**
 * Check if error is AI-related and return appropriate status code
 */
export function getAIErrorStatus(error: unknown): number {
  if (error instanceof AIRateLimitError) return 429;
  if (error instanceof AIPaymentError) return 402;
  if (error instanceof AIError) return 500;
  return 500;
}
