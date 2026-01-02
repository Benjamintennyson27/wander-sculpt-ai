/**
 * Activity Content Formatter & Sanitizer
 * Prevents incomplete/broken text fragments from displaying
 */

// ============================================
// Types
// ============================================

export interface RawActivityDetails {
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

export interface FormattedActivityDetails {
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

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

// ============================================
// Validation Patterns
// ============================================

/** Patterns indicating incomplete/truncated data */
const INCOMPLETE_PATTERNS = [
  /\.\.\.\s*$/,
  /…\s*$/,
  /\s+rev\.?\s*$/i,
  /\s+conta\.?\s*$/i,
  /\s+addr\.?\s*$/i,
  /\s+tim\.?\s*$/i,
  /\s+ph\.?\s*$/i,
  /\s+num\.?\s*$/i,
  /\s+cont\.?\s*$/i,
  /,\s*$/,
  /:\s*$/,
  /\[\s*$/,
  /\(\s*$/,
];

/** Common garbage/placeholder patterns */
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

// ============================================
// Validation Helpers
// ============================================

function isIncomplete(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length < 3 || INCOMPLETE_PATTERNS.some(p => p.test(trimmed));
}

function isGarbage(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length < 2 || GARBAGE_PATTERNS.some(p => p.test(trimmed));
}

// ============================================
// String Cleaners
// ============================================

function cleanString(value: string | null | undefined, maxLength = 100): string | null {
  if (!value || typeof value !== 'string') return null;
  
  let cleaned = value.trim().replace(/^[a-zA-Z\s]+[:\-]\s*/, '');
  
  if (isIncomplete(cleaned) || isGarbage(cleaned)) return null;
  
  if (cleaned.length > maxLength) {
    const lastSpace = cleaned.lastIndexOf(' ', maxLength - 3);
    cleaned = lastSpace > maxLength / 2 
      ? cleaned.slice(0, lastSpace) + '…'
      : cleaned.slice(0, maxLength - 3) + '…';
  }
  
  return cleaned;
}

function cleanPhone(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return null;
  
  const cleaned = value.trim();
  return isIncomplete(cleaned) ? null : cleaned;
}

function cleanAddress(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  
  let cleaned = value.trim();
  
  if (cleaned.length < 10 || isIncomplete(cleaned) || isGarbage(cleaned)) return null;
  
  if (cleaned.length > 80) {
    const lastComma = cleaned.lastIndexOf(',', 77);
    cleaned = lastComma > 30 ? cleaned.slice(0, lastComma) : cleaned.slice(0, 77) + '…';
  }
  
  return cleaned;
}

function cleanPrice(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  
  let cleaned = value.trim();
  
  if (/free/i.test(cleaned)) return 'Free';
  if (!/[\d₹$€£¥]/.test(cleaned) || isIncomplete(cleaned)) return null;
  
  cleaned = cleaned.replace(/^(entry|fee|price|cost)\s*[:\-]?\s*/i, '');
  
  return cleaned.length > 50 ? cleaned.slice(0, 47) + '…' : cleaned;
}

// ============================================
// Number Parsers
// ============================================

function parseRating(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'number') {
    return value > 0 && value <= 5 ? Math.round(value * 10) / 10 : null;
  }
  
  const match = String(value).match(/(\d+\.?\d*)/);
  if (match) {
    const num = parseFloat(match[1]);
    return num > 0 && num <= 5 ? Math.round(num * 10) / 10 : null;
  }
  
  return null;
}

function parseReviewCount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'number') {
    return value > 0 ? Math.round(value) : null;
  }
  
  const cleaned = String(value).replace(/reviews?/i, '').trim();
  const kMatch = cleaned.match(/(\d+\.?\d*)\s*k/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  
  const num = parseInt(cleaned.replace(/,/g, ''), 10);
  return isNaN(num) || num <= 0 ? null : num;
}

// ============================================
// Main Formatters
// ============================================

/**
 * Sanitizes all activity details, returning null for invalid/incomplete fields
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
 * Format duration in minutes to a readable string
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  
  return `${hours}h ${mins}m`;
}

/**
 * Format cost range in INR
 */
export function formatCostRange(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  if (min === 0 && max === 0) return 'Free';
  
  const minVal = min || 0;
  const maxVal = max || minVal;
  
  if (minVal === maxVal) return `₹${minVal.toLocaleString('en-IN')}`;
  
  return `₹${minVal.toLocaleString('en-IN')} - ₹${maxVal.toLocaleString('en-IN')}`;
}

/**
 * Safely parse and validate sources array
 */
export function parseSources(sources: unknown): Source[] {
  if (!sources || !Array.isArray(sources)) return [];
  
  return sources
    .filter((s): s is Record<string, unknown> => 
      typeof s === 'object' && s !== null && 'url' in s && 'title' in s
    )
    .map(s => ({
      title: String(s.title || 'Source'),
      url: String(s.url || ''),
      snippet: String(s.snippet || ''),
    }))
    .filter(s => s.url.startsWith('http'));
}
