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

