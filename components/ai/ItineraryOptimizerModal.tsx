"use client";

import { useState } from "react";
import {
  Sparkles,
  X,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
  RotateCw,
  Info,
  Sliders,
  DollarSign,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OptimizationResult, ProposedItemChange } from "@/lib/ai/optimizer";
import type { ItineraryItem } from "@/components/trip/types";

interface ItineraryOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripTitle: string;
  totalActivities: number;
  onSuccess: (updatedItems: ItineraryItem[]) => void;
}

export function ItineraryOptimizerModal({
  isOpen,
  onClose,
  tripId,
  tripTitle,
  totalActivities,
  onSuccess,
}: ItineraryOptimizerModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  async function handleRunOptimizer() {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/ai/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to analyze itinerary");
      }

      const data: { result: OptimizationResult } = await res.json();
      setResult(data.result);

      // Select all suggested changes by default
      const initialSelection: Record<string, boolean> = {};
      data.result.changes.forEach((ch) => {
        initialSelection[ch.itemId] = true;
      });
      setSelectedChanges(initialSelection);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error analyzing itinerary"
      );
    } finally {
      setIsLoading(false);
    }
  }

  function toggleChange(itemId: string) {
    setSelectedChanges((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  }

  function toggleAll(selectAll: boolean) {
    if (!result) return;
    const updated: Record<string, boolean> = {};
    result.changes.forEach((ch) => {
      updated[ch.itemId] = selectAll;
    });
    setSelectedChanges(updated);
  }

  async function handleApplyApproved() {
    if (!result) return;

    const approvedList = result.changes.filter(
      (ch) => selectedChanges[ch.itemId]
    );

    if (approvedList.length === 0) {
      setErrorMsg("Please select at least one optimization change to apply.");
      return;
    }

    setIsApplying(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/ai/optimize/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          approvedChanges: approvedList,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to apply optimization updates");
      }

      const data = await res.json();
      onSuccess(data.items || []);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error applying optimizations"
      );
      setIsApplying(false);
    }
  }

  const selectedCount = result
    ? result.changes.filter((ch) => selectedChanges[ch.itemId]).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  AI Itinerary Optimizer
                </h3>
                <Badge
                  variant="outline"
                  className="border-purple-200 bg-purple-50 text-purple-700 text-[10px]"
                >
                  Schedule Polish
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Pacing analysis, conflict resolution, and intelligent activity reordering.
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Initial State / Start Prompt */}
          {!result && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Sliders className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Ready to Optimize &ldquo;{tripTitle}&rdquo;
              </h4>
              <p className="text-xs text-slate-500 max-w-md">
                The optimizer will review your {totalActivities} planned activities, detect timing overlaps, smooth daily pacing, and recommend a logical chronological sequence.
              </p>
              <div className="pt-2">
                <Button
                  onClick={handleRunOptimizer}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-9 px-5 font-semibold shadow-xs"
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Analyze & Optimize Itinerary
                </Button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <Sparkles className="h-7 w-7 animate-pulse text-purple-600" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Analyzing Schedule & Pacing...
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Examining daily activity rhythm, checking time overlaps, and balancing budget feasibility.
              </p>
              <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600" />
                <span>Generating non-destructive optimization diff...</span>
              </div>
            </div>
          )}

          {/* Results View */}
          {result && !isLoading && (
            <div className="space-y-5">
              {/* Analysis Summary Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Pacing & Rhythm */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                    Pacing & Schedule Balance
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {result.analysis.pacingSummary}
                  </p>
                </div>

                {/* Budget Check */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    Budget Assessment
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {result.analysis.budgetSummary}
                  </p>
                </div>
              </div>

              {/* Timing Observations / Conflicts */}
              {result.analysis.timingObservations.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-1">
                  <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    Schedule Observations
                  </span>
                  <ul className="list-disc pl-5 text-xs text-amber-800 space-y-0.5">
                    {result.analysis.timingObservations.map((obs, idx) => (
                      <li key={idx}>{obs}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Proposed Changes Diff List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Proposed Optimizations ({result.changes.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Review proposed adjustments before applying. Unchecked items remain untouched.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleAll(true)}
                      className="text-[11px] text-purple-600 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => toggleAll(false)}
                      className="text-[11px] text-slate-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {result.changes.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-xs text-emerald-800">
                    <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600 mb-1" />
                    Your itinerary is already well-sequenced and conflict-free! No changes are needed.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {result.changes.map((ch) => {
                      const isChecked = Boolean(selectedChanges[ch.itemId]);
                      const hasTimeChange =
                        ch.originalStartTime !== ch.suggestedStartTime ||
                        ch.originalEndTime !== ch.suggestedEndTime;
                      const hasOrderChange =
                        ch.originalDay !== ch.suggestedDay ||
                        ch.originalOrder !== ch.suggestedOrder;

                      return (
                        <div
                          key={ch.itemId}
                          onClick={() => toggleChange(ch.itemId)}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                            isChecked
                              ? "border-purple-200 bg-purple-50/20 hover:bg-purple-50/40"
                              : "border-slate-200 bg-white hover:bg-slate-50 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChange(ch.itemId)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />

                          <div className="flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {ch.title}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] text-slate-600"
                              >
                                {ch.category}
                              </Badge>
                            </div>

                            {/* Before vs After Diff Preview */}
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              {/* Current */}
                              <div className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                                <span className="font-semibold text-slate-700">Current: </span>
                                Day {ch.originalDay} (Slot #{ch.originalOrder + 1})
                                {ch.originalStartTime && ` • ${ch.originalStartTime}-${ch.originalEndTime}`}
                              </div>

                              <ArrowRight className="h-3 w-3 text-slate-400" />

                              {/* Suggested */}
                              <div className="rounded bg-purple-100/70 px-2 py-1 text-purple-900 font-medium">
                                <span className="font-semibold text-purple-950">Optimized: </span>
                                Day {ch.suggestedDay} (Slot #{ch.suggestedOrder + 1})
                                {ch.suggestedStartTime && ` • ${ch.suggestedStartTime}-${ch.suggestedEndTime}`}
                              </div>
                            </div>

                            {/* Rationale */}
                            <p className="text-[11px] text-purple-800 italic">
                              &ldquo;{ch.reason}&rdquo;
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Assumptions & Disclaimers */}
              {result.analysis.assumptions.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[10px] text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Optimizer Assumptions:
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {result.analysis.assumptions.map((as, i) => (
                      <li key={i}>{as}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-3.5 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isApplying}
            className="text-xs"
          >
            Discard
          </Button>

          <div className="flex items-center gap-2">
            {result && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRunOptimizer}
                disabled={isLoading || isApplying}
                className="text-xs"
              >
                <RotateCw className="mr-1 h-3 w-3" />
                Re-Analyze
              </Button>
            )}

            {result && result.changes.length > 0 && (
              <Button
                type="button"
                onClick={handleApplyApproved}
                disabled={selectedCount === 0 || isApplying}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8.5 px-4 font-semibold shadow-xs"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Applying Changes...
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 stroke-[3]" />
                    Apply Changes ({selectedCount})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

