"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  HelpCircle,
  Info,
  MapPin,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TripHealthResult, IssueSeverity, HealthCategory } from "@/lib/scoring/tripHealth";

interface TripHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripTitle: string;
  health: TripHealthResult;
  onOpenOptimizer?: () => void;
}

export function TripHealthModal({
  isOpen,
  onClose,
  tripId,
  tripTitle,
  health,
  onOpenOptimizer,
}: TripHealthModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "issues" | "suggestions">("overview");

  if (!isOpen) return null;

  const { score, grade, breakdown, issues, suggestions, dataLimitations } = health;

  // Group issues by severity
  const criticalIssues = issues.filter((i) => i.severity === "critical");
  const warningIssues = issues.filter((i) => i.severity === "warning");
  const infoIssues = issues.filter((i) => i.severity === "info");

  function getGradeColor(g: typeof grade) {
    switch (g) {
      case "Excellent":
        return {
          text: "text-emerald-700",
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          ring: "ring-emerald-500",
          bar: "bg-emerald-500",
        };
      case "Good":
        return {
          text: "text-blue-700",
          bg: "bg-blue-50",
          border: "border-blue-200",
          ring: "ring-blue-500",
          bar: "bg-blue-500",
        };
      case "Needs Attention":
        return {
          text: "text-amber-700",
          bg: "bg-amber-50",
          border: "border-amber-200",
          ring: "ring-amber-500",
          bar: "bg-amber-500",
        };
      case "Critical Issues":
      default:
        return {
          text: "text-rose-700",
          bg: "bg-rose-50",
          border: "border-rose-200",
          ring: "ring-rose-500",
          bar: "bg-rose-500",
        };
    }
  }

  const gradeColors = getGradeColor(grade);

  const categoryConfig: Record<
    HealthCategory,
    { title: string; icon: typeof DollarSign; colorClass: string }
  > = {
    budgetFit: {
      title: "Budget Fit",
      icon: DollarSign,
      colorClass: "text-emerald-600 bg-emerald-50",
    },
    scheduleConflicts: {
      title: "Schedule Conflicts",
      icon: Clock,
      colorClass: "text-purple-600 bg-purple-50",
    },
    dailyWorkload: {
      title: "Daily Workload",
      icon: Calendar,
      colorClass: "text-blue-600 bg-blue-50",
    },
    restTime: {
      title: "Rest & Transition Gaps",
      icon: Sliders,
      colorClass: "text-amber-600 bg-amber-50",
    },
    travelFeasibility: {
      title: "Travel Feasibility",
      icon: MapPin,
      colorClass: "text-indigo-600 bg-indigo-50",
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gradeColors.bg} ${gradeColors.text} shadow-inner`}>
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Trip Health Score
                </h3>
                <Badge
                  variant="outline"
                  className={`${gradeColors.border} ${gradeColors.bg} ${gradeColors.text} text-[10px] font-semibold`}
                >
                  {grade} ({score}/100)
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Deterministic feasibility, schedule balance, and budget analysis for &ldquo;{tripTitle}&rdquo;
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Categories & Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("issues")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "issues"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>Issues & Alerts</span>
            {issues.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  criticalIssues.length > 0
                    ? "bg-rose-100 text-rose-700"
                    : warningIssues.length > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {issues.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suggestions")}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "suggestions"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>Actionable Suggestions</span>
            {suggestions.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                {suggestions.length}
              </span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Score Banner */}
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border ${gradeColors.border} ${gradeColors.bg} p-4`}>
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-xs border border-slate-100">
                <span className={`text-xl font-black ${gradeColors.text}`}>
                  {score}
                </span>
                <span className="absolute bottom-1 text-[9px] font-medium text-slate-400">
                  /100
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Trip Quality: {grade}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 max-w-md">
                  {score >= 90
                    ? "Your itinerary has no major conflicts, comfortable daily workload, and sensible timing buffers."
                    : score >= 75
                    ? "A solid travel plan with only minor timing or workload opportunities for improvement."
                    : score >= 55
                    ? "A few schedule overlaps, tight buffers, or budget mismatches could impact your experience."
                    : "Multiple schedule conflicts, overbooked days, or budget issues need attention before traveling."}
                </p>
              </div>
            </div>

            {onOpenOptimizer && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenOptimizer();
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8.5 gap-1.5 shadow-xs font-semibold shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-200" />
                ✨ Open AI Optimizer
              </Button>
            )}
          </div>

          {/* TAB 1: OVERVIEW & BREAKDOWN */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Category Score Breakdown
              </h4>

              <div className="space-y-3">
                {(
                  Object.entries(breakdown) as [
                    HealthCategory,
                    TripHealthResult["breakdown"][HealthCategory]
                  ][]
                ).map(([catKey, catData]) => {
                  const config = categoryConfig[catKey];
                  const Icon = config.icon;
                  const percent = Math.round((catData.score / catData.maxScore) * 100);

                  return (
                    <div
                      key={catKey}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.colorClass}`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              {config.title}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {catData.summary}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-4">
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-sm font-bold text-slate-900">
                              {catData.score}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              /{catData.maxScore}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              catData.status === "excellent"
                                ? "text-emerald-600"
                                : catData.status === "good"
                                ? "text-blue-600"
                                : catData.status === "warning"
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {catData.status}
                          </span>
                        </div>
                      </div>

                      {/* Progress meter */}
                      <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            percent >= 85
                              ? "bg-emerald-500"
                              : percent >= 65
                              ? "bg-blue-500"
                              : percent >= 45
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Data Limitations Notice */}
              {dataLimitations.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                    <HelpCircle className="h-4 w-4 text-slate-500" />
                    <span>Data Disclosures & Limitations</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px]">
                    {dataLimitations.map((limitation, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ISSUES & ALERTS */}
          {activeTab === "issues" && (
            <div className="space-y-4">
              {issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    No Health Issues Detected
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Your trip has no schedule conflicts, excessive day workloads, or tight buffers.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Critical Issues */}
                  {criticalIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 flex items-start gap-3"
                    >
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-950">
                            {issue.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-rose-300 bg-rose-100 text-rose-800 text-[9px] uppercase"
                          >
                            Critical
                          </Badge>
                        </div>
                        <p className="text-rose-800 text-[11px] leading-relaxed">
                          {issue.description}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Warning Issues */}
                  {warningIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-3"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-950">
                            {issue.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-100 text-amber-800 text-[9px] uppercase"
                          >
                            Warning
                          </Badge>
                        </div>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          {issue.description}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Info Issues */}
                  {infoIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-3"
                    >
                      <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-950">
                            {issue.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-blue-300 bg-blue-100 text-blue-800 text-[9px] uppercase"
                          >
                            Info
                          </Badge>
                        </div>
                        <p className="text-blue-800 text-[11px] leading-relaxed">
                          {issue.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIONABLE SUGGESTIONS */}
          {activeTab === "suggestions" && (
            <div className="space-y-4">
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Itinerary is Well-Optimized
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    No immediate adjustments needed. Your travel schedule is ready to go!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {categoryConfig[suggestion.category]?.title || "Recommendation"}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {suggestion.action}
                        </p>
                      </div>

                      <div className="shrink-0 self-end sm:self-center">
                        {suggestion.recommendedTool === "optimizer" && onOpenOptimizer && (
                          <Button
                            size="sm"
                            onClick={() => {
                              onClose();
                              onOpenOptimizer();
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1 shadow-xs"
                          >
                            <Sparkles className="h-3 w-3" />
                            Run Optimizer
                          </Button>
                        )}

                        {suggestion.recommendedTool === "budget" && (
                          <Link href={`/trips/${tripId}/budget`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 gap-1 border-slate-200"
                            >
                              <DollarSign className="h-3 w-3" />
                              View Budget
                            </Button>
                          </Link>
                        )}

                        {suggestion.recommendedTool === "calendar" && (
                          <Link href={`/trips/${tripId}/calendar`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 gap-1 border-slate-200"
                            >
                              <Clock className="h-3 w-3" />
                              Calendar View
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Deterministic 5-factor health score (updates in real time)</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="text-xs h-8 px-4 border-slate-200 bg-white"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

