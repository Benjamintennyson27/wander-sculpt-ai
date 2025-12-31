/**
 * Activity Content Formatter & Sanitizer
 * Prevents incomplete/broken text fragments from displaying
 */

interface RawActivityDetails {
  timings?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: string | number | null;
  reviews?: string | number | null;
  price?: string | null;
  entryFee?: string | null;
  hours?: string | null;
  closedDay?: string | null;
  notes?: string | null;
}

interface FormattedActivityDetails {
  timings: string | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  price: string | null;
  entryFee: string | null;
  hours: string | null;
  closedDay: string | null;
  notes: string | null;
}

// Patterns that indicate incomplete/truncated data
const INCOMPLETE_PATTERNS = [
  /\.\.\.\s*$/,           // ends with ...
  /…\s*$/,                // ends with ellipsis character
  /\s+rev\.?\s*$/i,       // ends with "rev" or "rev."
  /\s+conta\.?\s*$/i,     // ends with "conta"
  /\s+addr\.?\s*$/i,      // ends with "addr"
  /\s+tim\.?\s*$/i,       // ends with "tim"
  /\s+ph\.?\s*$/i,        // ends with "ph"
  /\s+num\.?\s*$/i,       // ends with "num"
  /\s+cont\.?\s*$/i,      // ends with "cont"
  /,\s*$/,                // ends with comma
  /:\s*$/,                // ends with colon
  /\[\s*$/,               // ends with open bracket
  /\(\s*$/,               // ends with open paren
];

// Common garbage patterns to remove
const GARBAGE_PATTERNS = [
  /^(timings|address|phone|contact|rating|reviews?|price|entry fee|hours?|closed|notes?)\s*[,:\-]?\s*/i,
  /^(contact number|opening hours?|entry|fee|cost)\s*[,:\-]?\s*/i,
  /\bN\/A\b/i,
  /\bnot available\b/i,
  /\bunknown\b/i,
  /\btbd\b/i,
  /\bvaries\b/i,
  /^-+$/,
  /^\s*$/,
];

/**
 * Check if a string appears incomplete/truncated
 */
function isIncomplete(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3) return true;
  return INCOMPLETE_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a string is garbage/placeholder data
 */
function isGarbage(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) return true;
  return GARBAGE_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Clean and validate a string field
 */
function cleanString(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  
  let cleaned = value.trim();
  
  // Remove common prefixes like "Timings: " or "Address - "
  cleaned = cleaned.replace(/^[a-zA-Z\s]+[:\-]\s*/, '');
  
  if (isIncomplete(cleaned)) return null;
  if (isGarbage(cleaned)) return null;
  
  // Truncate very long strings gracefully (max 100 chars)
  if (cleaned.length > 100) {
    const lastSpace = cleaned.lastIndexOf(' ', 97);
    if (lastSpace > 50) {
      cleaned = cleaned.slice(0, lastSpace) + '…';
    } else {
      cleaned = cleaned.slice(0, 97) + '…';
    }
  }
  
  return cleaned;
}

/**
 * Parse a rating value (handle various formats)
 */
function parseRating(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'number') {
    return value > 0 && value <= 5 ? Math.round(value * 10) / 10 : null;
  }
  
  if (typeof value === 'string') {
    // Extract number from strings like "4.5/5", "4.5 stars", "4.5"
    const match = value.match(/(\d+\.?\d*)/);
    if (match) {
      const num = parseFloat(match[1]);
      return num > 0 && num <= 5 ? Math.round(num * 10) / 10 : null;
    }
  }
  
  return null;
}

/**
 * Parse review count (handle various formats)
 */
function parseReviewCount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'number') {
    return value > 0 ? Math.round(value) : null;
  }
  
  if (typeof value === 'string') {
    // Handle "1.2k reviews", "1,234 reviews", "1234"
    const cleaned = value.replace(/reviews?/i, '').trim();
    const match = cleaned.match(/(\d+\.?\d*)\s*k/i);
    if (match) {
      return Math.round(parseFloat(match[1]) * 1000);
    }
    
    const num = parseInt(cleaned.replace(/,/g, ''), 10);
    return isNaN(num) || num <= 0 ? null : num;
  }
  
  return null;
}

/**
 * Clean phone number
 */
function cleanPhone(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  
  // Must contain at least 6 digits to be a valid phone
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return null;
  
  const cleaned = value.trim();
  if (isIncomplete(cleaned)) return null;
  
  return cleaned;
}

/**
 * Clean address
 */
function cleanAddress(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  
  let cleaned = value.trim();
  
  // Must be at least 10 chars to be a real address
  if (cleaned.length < 10) return null;
  if (isIncomplete(cleaned)) return null;
  if (isGarbage(cleaned)) return null;
  
  // Truncate long addresses
  if (cleaned.length > 80) {
    const lastComma = cleaned.lastIndexOf(',', 77);
    if (lastComma > 30) {
      cleaned = cleaned.slice(0, lastComma);
    } else {
      cleaned = cleaned.slice(0, 77) + '…';
    }
  }
  
  return cleaned;
}

/**
 * Clean price/entry fee
 */
function cleanPrice(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  
  let cleaned = value.trim();
  
  // Check for free entry
  if (/free/i.test(cleaned)) return 'Free';
  
  // Must contain a number or currency symbol
  if (!/[\d₹$€£¥]/.test(cleaned)) return null;
  
  if (isIncomplete(cleaned)) return null;
  
  // Clean up common formats
  cleaned = cleaned.replace(/^(entry|fee|price|cost)\s*[:\-]?\s*/i, '');
  
  if (cleaned.length > 50) {
    cleaned = cleaned.slice(0, 47) + '…';
  }
  
  return cleaned;
}

/**
 * Main formatter function - sanitizes all activity details
 */
export function formatActivityDetails(raw: RawActivityDetails): FormattedActivityDetails {
  return {
    timings: cleanString(raw.timings || raw.hours),
    address: cleanAddress(raw.address),
    phone: cleanPhone(raw.phone),
    rating: parseRating(raw.rating),
    reviewCount: parseReviewCount(raw.reviews),
    price: cleanPrice(raw.price || raw.entryFee),
    entryFee: cleanPrice(raw.entryFee || raw.price),
    hours: cleanString(raw.hours || raw.timings),
    closedDay: cleanString(raw.closedDay),
    notes: cleanString(raw.notes),
  };
}

/**
 * Parse comma-separated AI response into structured object
 * Handles messy AI output like "timings, address, contact number, rev..."
 */
export function parseAIFieldList(input: string | null | undefined): Partial<RawActivityDetails> {
  if (!input || typeof input !== 'string') return {};
  
  const result: Partial<RawActivityDetails> = {};
  
  // Split by common delimiters
  const parts = input.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  
  for (const part of parts) {
    // Skip incomplete parts
    if (isIncomplete(part)) continue;
    if (isGarbage(part)) continue;
    
    // Try to identify what type of data this is
    if (/^\d{1,2}:\d{2}/.test(part) || /am|pm|hours?/i.test(part)) {
      result.timings = part;
    } else if (/road|street|lane|nagar|colony|block|sector|city|area/i.test(part)) {
      result.address = part;
    } else if (/^\+?\d[\d\s\-()]{8,}$/.test(part)) {
      result.phone = part;
    } else if (/₹|rs\.?|inr|\$|€/i.test(part)) {
      result.price = part;
    } else if (/\d+\.?\d*\s*(stars?|rating)/i.test(part)) {
      result.rating = part;
    }
  }
  
  return result;
}

/**
 * Format a duration in minutes to a readable string
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  
  return `${hours}h ${mins}m`;
}

/**
 * Format cost range
 */
export function formatCostRange(
  min: number | null | undefined, 
  max: number | null | undefined
): string | null {
  if (!min && !max) return null;
  if (min === 0 && max === 0) return 'Free';
  
  const minVal = min || 0;
  const maxVal = max || minVal;
  
  if (minVal === maxVal) {
    return `₹${minVal.toLocaleString('en-IN')}`;
  }
  
  return `₹${minVal.toLocaleString('en-IN')} - ₹${maxVal.toLocaleString('en-IN')}`;
}