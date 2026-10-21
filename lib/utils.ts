import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeRange(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
  if (start) return `Starts at ${start.slice(0, 5)}`;
  return `Ends by ${end?.slice(0, 5)}`;
}

export function getCategoryBadgeClass(category: string): string {
  switch (category) {
    case "Culture & History":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Food & Dining":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Sightseeing":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Adventure":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Relaxation":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "Shopping":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "Nature":
      return "bg-green-50 text-green-700 border-green-200";
    case "Entertainment":
      return "bg-violet-50 text-violet-700 border-violet-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

/**
 * Computes a standardized ISO date (YYYY-MM-DD) for a given itinerary day number,
 * keeping day schedules, calendar events, and trip start date in sync.
 */
export function computeDateForDay(
  startDateStr: string | null | undefined,
  dayNumber: number
): string | null {
  if (!startDateStr || !dayNumber || dayNumber < 1) return null;
  const parts = startDateStr.split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  const [year, month, day] = parts;
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  dateObj.setUTCDate(dateObj.getUTCDate() + (dayNumber - 1));
  return dateObj.toISOString().split("T")[0];
}

/**
 * Finds the correct trip_stop_id for an activity scheduled on a specific day number,
 * evaluating date spans first and falling back to city stop sequencing.
 */
export function getStopIdForDay(
  stops: Array<{
    id: string;
    arrival_date?: string | null;
    departure_date?: string | null;
    order_index?: number;
  }>,
  tripStartDate: string | null | undefined,
  dayNumber: number
): string | null {
  if (!stops || stops.length === 0) return null;
  if (stops.length === 1) return stops[0].id;

  // 1. Date-based matching if trip start date and stop dates exist
  if (tripStartDate && dayNumber >= 1) {
    const dayDate = computeDateForDay(tripStartDate, dayNumber);
    if (dayDate) {
      const dateMatched = stops.find((s) => {
        if (!s.arrival_date || !s.departure_date) return false;
        return s.arrival_date <= dayDate && dayDate <= s.departure_date;
      });
      if (dateMatched) return dateMatched.id;
    }
  }

  // 2. Sequence-based matching: map day index to stops sequence
  const sortedStops = [...stops].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const stopIndex = Math.min(Math.max(0, dayNumber - 1), sortedStops.length - 1);
  return sortedStops[stopIndex]?.id || null;
}

/**
 * Returns a clean symbol or prefix for any currency code without falling back to "$" for unmapped foreign currencies.
 */
export function getCurrencySymbol(currency?: string | null): string {
  if (!currency) return "$";
  const code = currency.trim().toUpperCase();
  switch (code) {
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    case "INR":
      return "₹";
    case "CAD":
      return "CA$";
    case "AUD":
      return "A$";
    case "CHF":
      return "CHF ";
    case "AED":
      return "AED ";
    case "THB":
      return "฿";
    case "SGD":
      return "S$";
    case "USD":
      return "$";
    default:
      return `${code} `;
  }
}

/**
 * Standardized currency formatting matching the stored currency symbol/code.
 */
export function formatCurrencyAmount(
  amount: number | null | undefined,
  currency?: string | null
): string {
  const num = Number(amount) || 0;
  const sym = getCurrencySymbol(currency);
  return `${sym}${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Helper to compute number of days between two YYYY-MM-DD strings inclusive.
 */
export function calculateDays(startStr?: string | null, endStr?: string | null): number {
  if (!startStr || !endStr) return 1;
  try {
    const s = new Date(startStr);
    const e = new Date(endStr);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return 1;
    }
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  } catch {
    return 1;
  }
}

