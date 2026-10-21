"use client";

import { Activity, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TripHealthResult } from "@/lib/scoring/tripHealth";

interface TripHealthBadgeProps {
  health: TripHealthResult;
  onClick: () => void;
  className?: string;
}

export function TripHealthBadge({ health, onClick, className = "" }: TripHealthBadgeProps) {
  const { score, grade } = health;

  function getBadgeStyling(g: typeof grade) {
    switch (g) {
      case "Excellent":
        return {
          textColor: "text-emerald-700",
          scoreColor: "text-emerald-600",
          badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
          hoverBg: "hover:bg-emerald-50/80 hover:border-emerald-300",
        };
      case "Good":
        return {
          textColor: "text-blue-700",
          scoreColor: "text-blue-600",
          badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
          hoverBg: "hover:bg-blue-50/80 hover:border-blue-300",
        };
      case "Needs Attention":
        return {
          textColor: "text-amber-700",
          scoreColor: "text-amber-600",
          badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
          hoverBg: "hover:bg-amber-50/80 hover:border-amber-300",
        };
      case "Critical Issues":
      default:
        return {
          textColor: "text-rose-700",
          scoreColor: "text-rose-600",
          badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
          hoverBg: "hover:bg-rose-50/80 hover:border-rose-300",
        };
    }
  }

  const styles = getBadgeStyling(grade);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 sm:px-3 text-left transition-all shadow-2xs ${styles.hoverBg} ${className}`}
      title="View Trip Health Score details and recommendations"
    >
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 ${styles.scoreColor} group-hover:scale-105 transition-transform`}>
          <Activity className="h-3.5 w-3.5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
            Health Score
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-sm font-extrabold ${styles.scoreColor}`}>
              {score}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">/100</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-2">
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold px-1.5 py-0.5 ${styles.badgeClass}`}
        >
          {grade}
        </Badge>
        <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}

