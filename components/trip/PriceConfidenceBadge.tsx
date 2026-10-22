"use client";

import { CheckCircle2, Sparkles, User, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getPriceConfidence,
  type PriceConfidenceInfo,
  type PriceConfidenceType,
} from "@/lib/budget/budgetEngine";

interface PriceConfidenceBadgeProps {
  confidence?: PriceConfidenceInfo;
  item?: {
    id?: string;
    activity_id?: string | null;
    activities?: any | null;
    estimated_cost?: number | string | null;
    notes?: string | null;
  };
  compact?: boolean;
  className?: string;
}

export function PriceConfidenceBadge({
  confidence: directConfidence,
  item,
  compact = false,
  className = "",
}: PriceConfidenceBadgeProps) {
  const conf = directConfidence || (item ? getPriceConfidence(item) : null);

  if (!conf) return null;

  function getBadgeStyling(type: PriceConfidenceType) {
    switch (type) {
      case "catalog":
        return {
          icon: CheckCircle2,
          border: "border-blue-200",
          bg: "bg-blue-50/80",
          text: "text-blue-700",
          iconColor: "text-blue-600",
          shortLabel: "Catalog",
        };
      case "ai_estimate":
        return {
          icon: Sparkles,
          border: "border-purple-200",
          bg: "bg-purple-50/80",
          text: "text-purple-700",
          iconColor: "text-purple-600",
          shortLabel: "AI Estimate",
        };
      case "user_entered":
        return {
          icon: User,
          border: "border-slate-200",
          bg: "bg-slate-100/80",
          text: "text-slate-700",
          iconColor: "text-slate-500",
          shortLabel: "User Entered",
        };
      case "unpriced":
      default:
        return {
          icon: HelpCircle,
          border: "border-amber-200",
          bg: "bg-amber-50/80",
          text: "text-amber-800",
          iconColor: "text-amber-600",
          shortLabel: "Unpriced",
        };
    }
  }

  const styles = getBadgeStyling(conf.type);
  const Icon = styles.icon;

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 text-[10px] font-medium transition-colors cursor-help ${styles.border} ${styles.bg} ${styles.text} ${className}`}
      title={`${conf.label}: ${conf.description}`}
    >
      <Icon className={`h-2.5 w-2.5 ${styles.iconColor} shrink-0`} />
      <span>{compact ? styles.shortLabel : conf.label}</span>
    </Badge>
  );
}

