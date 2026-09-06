/**
 * SecureChain Pay — Centralized Timezone Service
 * 
 * Architecture Rules:
 * 1. Database / Backend stores all timestamps in UTC / ISO-8601 strings.
 * 2. Frontend converts timestamps to user's local timezone ('Asia/Kolkata') for display.
 * 3. Never use manual hour/minute addition (+5:30 arithmetic). Use Intl.DateTimeFormat with IANA timezones.
 * 4. Convert Binance Unix millisecond timestamps (e.g. 1750000000000) to UTC Date first.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Safely parses any date input (ISO string, Date object, Unix ms timestamp) into a UTC Date object.
 */
export function parseToDate(input: Date | string | number | null | undefined): Date | null {
  if (input === null || input === undefined) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  
  if (typeof input === 'number') {
    // If timestamp is in seconds instead of milliseconds (e.g. Unix epoch in sec)
    const ms = input < 1e11 ? input * 1000 : input;
    const date = new Date(ms);
    return isNaN(date.getTime()) ? null : date;
  }
  
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    
    // Check if stringified numeric timestamp (e.g. "1750000000000")
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ms = num < 1e11 ? num * 1000 : num;
      const date = new Date(ms);
      if (!isNaN(date.getTime())) return date;
    }
    
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  return null;
}

/**
 * Formats a timestamp into a full date and time string in Asia/Kolkata.
 * Example output: "06 Sep 2026, 05:30:15 PM"
 */
export function formatDateTime(
  input: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  options: { includeSeconds?: boolean } = { includeSeconds: true }
): string {
  const date = parseToDate(input);
  if (!date) return 'N/A';

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: options.includeSeconds ? '2-digit' : undefined,
      hour12: true,
    });
    return formatter.format(date);
  } catch (err) {
    console.warn('[TimezoneService] Formatting error:', err);
    return date.toLocaleString();
  }
}

/**
 * Formats time only in Asia/Kolkata.
 * Example output: "05:30:15 PM"
 */
export function formatTime(
  input: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  includeSeconds: boolean = true
): string {
  const date = parseToDate(input);
  if (!date) return 'N/A';

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    });
    return formatter.format(date);
  } catch (err) {
    return date.toLocaleTimeString();
  }
}

/**
 * Formats date only in Asia/Kolkata.
 * Example output: "06 Sep 2026"
 */
export function formatDate(
  input: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const date = parseToDate(input);
  if (!date) return 'N/A';

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return formatter.format(date);
  } catch (err) {
    return date.toLocaleDateString();
  }
}

/**
 * Formats relative time (e.g. "Just now", "12s ago", "5m ago", "2h ago")
 */
export function formatRelativeTime(input: Date | string | number | null | undefined): string {
  const date = parseToDate(input);
  if (!date) return 'N/A';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0 || diffMs < 5000) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return formatDate(date);
}

/**
 * Special Helper for Binance Unix milliseconds timestamps
 */
export function formatBinanceTimestamp(
  unixMs: number | string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  return formatDateTime(unixMs, timeZone, { includeSeconds: true });
}
