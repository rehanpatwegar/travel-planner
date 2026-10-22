"use client";

import { useState, useMemo, useEffect } from "react";
import {
  TrendingDown,
  Sparkles,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Trip, ItineraryItem } from "./types";
import { PriceConfidenceBadge } from "./PriceConfidenceBadge";
import {
  generateCostSavingPlan,
  type CostSavingProposal,
  type CostSavingPlan,
} from "@/lib/budget/budgetEngine";
import { formatCurrencyAmount } from "@/lib/utils";

interface CostSavingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  items: ItineraryItem[];
  onSuccess: (updatedItems: ItineraryItem[]) => void;
}

export function CostSavingModal({
  isOpen,
  onClose,
  trip,
  items,
  onSuccess,
}: CostSavingModalProps) {
  const primaryCurrency = (trip.currency || "USD").trim().toUpperCase();

  // Generate initial plan
  const plan: CostSavingPlan = useMemo(() => {
    return generateCostSavingPlan({
      trip,
      items,
      targetReductionRatio: 0.3,
    });
  }, [trip, items]);

  // Track user selection of individual proposals
  const [selectedProposals, setSelectedProposals] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    plan.proposals.forEach((p) => {
      initial[p.id] = p.selectedByDefault;
    });
    return initial;
  });

  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Synchronize proposal selection and reset modal state when opened or when plan updates
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, boolean> = {};
      plan.proposals.forEach((p) => {
        initial[p.id] = p.selectedByDefault;
      });
      setSelectedProposals(initial);
      setApplyError(null);
      setIsApplying(false);
    }
  }, [isOpen, plan]);

  // Calculate dynamically projected savings based on active selections unconditionally
  const { currentSavings, currentPercentage, selectedCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    plan.proposals.forEach((p) => {
      if (selectedProposals[p.id]) {
        sum += p.estimatedSavings;
        count += 1;
      }
    });

    const percent =
      plan.currentPlannedCost > 0
        ? Math.round((sum / plan.currentPlannedCost) * 1000) / 10
        : 0;

    return {
      currentSavings: Math.round(sum * 100) / 100,
      currentPercentage: percent,
      selectedCount: count,
    };
  }, [plan, selectedProposals]);

  // All React Hooks are called unconditionally above. If closed, render nothing.
  if (!isOpen) return null;

  function toggleProposal(id: string) {
    setSelectedProposals((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function toggleAll(selectAll: boolean) {
    const updated: Record<string, boolean> = {};
    plan.proposals.forEach((p) => {
      updated[p.id] = selectAll;
    });
    setSelectedProposals(updated);
  }

  async function handleApplyChanges() {
    setIsApplying(true);
    setApplyError(null);

    try {
      const activeProposals = plan.proposals.filter((p) => selectedProposals[p.id]);
      if (activeProposals.length === 0) {
        onClose();
        return;
      }

      const updatedMap = new Map<string, Partial<ItineraryItem>>();

      // Execute verified item updates sequentially
      for (const prop of activeProposals) {
        const res = await fetch(`/api/trips/${trip.id}/items/${prop.itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: prop.proposedTitle,
            estimated_cost: prop.proposedCost,
            notes: `[Budget Optimization: 30% Cheaper Plan] ${prop.tradeOff}`,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to update ${prop.currentTitle}`);
        }

        const data = await res.json();
        if (data.item) {
          updatedMap.set(prop.itemId, data.item);
        }
      }

      // Merge updated items with local state
      const nextItems = items.map((it) => {
        const updated = updatedMap.get(it.id);
        return updated ? { ...it, ...updated } : it;
      });

      onSuccess(nextItems);
      onClose();
    } catch (err: unknown) {
      setApplyError(err instanceof Error ? err.message : "Error applying budget plan");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-emerald-50/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-inner">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Make This Trip 30% Cheaper
                </h3>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-100/70 text-emerald-800 text-[10px] font-semibold"
                >
                  Budget Optimizer
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Data-driven activity substitutions with transparent trade-offs for &ldquo;{trip.title}&rdquo;
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {applyError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{applyError}</span>
            </div>
          )}

          {!plan.isEligible ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Info className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                No Eligible Activities to Reduce
              </h4>
              <p className="text-xs text-slate-500 max-w-md">
                {plan.ineligibilityReason ||
                  "All current planned activities are free or have unentered prices. Add priced activities to generate cost-saving alternatives."}
              </p>
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
                  Back to Budget
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Savings Targets Summary Bar */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Current Planned
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrencyAmount(plan.currentPlannedCost, primaryCurrency)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    30% Reduction Target
                  </span>
                  <span className="font-bold text-slate-700 text-sm">
                    -{formatCurrencyAmount(plan.targetSavings, primaryCurrency)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Projected Savings
                  </span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {formatCurrencyAmount(currentSavings, primaryCurrency)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Reduction Achieved
                  </span>
                  <span
                    className={`font-bold text-sm ${
                      currentPercentage >= 28 ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {currentPercentage}%
                  </span>
                </div>
              </div>

              {/* Proposals Checklist Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Proposed Substitutions ({selectedCount} of {plan.proposals.length} selected)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Review each candidate. Uncheck any activities you wish to keep unchanged.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Proposals Cards */}
              <div className="space-y-3">
                {plan.proposals.map((proposal) => {
                  const isChecked = !!selectedProposals[proposal.id];

                  return (
                    <div
                      key={proposal.id}
                      onClick={() => toggleProposal(proposal.id)}
                      className={`rounded-xl border p-4 transition-all cursor-pointer select-none text-xs ${
                        isChecked
                          ? "border-emerald-300 bg-emerald-50/30 shadow-2xs"
                          : "border-slate-200 bg-white opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Custom Checkbox */}
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isChecked
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>

                        <div className="flex-1 space-y-1.5 min-w-0">
                          {/* Current vs Proposed Activity Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {proposal.currentTitle}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[9px] border-slate-200 text-slate-500 py-0"
                                >
                                  Day {proposal.dayNumber}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="line-through text-slate-400">
                                  {formatCurrencyAmount(proposal.currentCost, primaryCurrency)}
                                </span>
                                <ArrowRight className="h-3 w-3 text-emerald-600" />
                                <span className="font-bold text-emerald-700">
                                  {proposal.proposedCost === 0
                                    ? "Free"
                                    : formatCurrencyAmount(proposal.proposedCost, primaryCurrency)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-100/70 text-emerald-800 text-[10px] font-bold"
                              >
                                Save {formatCurrencyAmount(proposal.estimatedSavings, primaryCurrency)}
                              </Badge>
                              <PriceConfidenceBadge
                                confidence={{
                                  type: "ai_estimate",
                                  label: "AI Alternative",
                                  description: "Suggested budget alternative.",
                                  confidenceGrade: "Approximate",
                                }}
                                compact
                              />
                            </div>
                          </div>

                          {/* Proposed Substitute Detail */}
                          <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1 text-[11px]">
                            <div className="font-semibold text-slate-800">
                              Proposed Change: {proposal.proposedTitle}
                            </div>
                            <div className="text-slate-500 leading-relaxed">
                              <span className="font-medium text-slate-700">Trade-off: </span>
                              {proposal.tradeOff}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Data & Estimates Disclaimer */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong>Safety & Transparency Notice:</strong> GlobeTrotter never silently overwrites itinerary items. Applying changes will update only the {selectedCount} selected activities with the proposed alternative titles, costs, and notes. Opening hours, free admission days, and live ticket prices require local verification.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-6 py-3.5 text-xs">
          <div className="text-[11px] text-slate-500">
            {plan.isEligible ? (
              <span>
                Selected savings:{" "}
                <strong className="text-emerald-700">
                  {formatCurrencyAmount(currentSavings, primaryCurrency)} ({currentPercentage}%)
                </strong>
              </span>
            ) : (
              <span>No changes available</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              disabled={isApplying}
              className="text-xs h-8.5 bg-white border-slate-200"
            >
              Cancel
            </Button>

            {plan.isEligible && (
              <Button
                size="sm"
                onClick={handleApplyChanges}
                disabled={isApplying || selectedCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8.5 px-4 font-semibold shadow-xs gap-1.5"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Applying Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Apply {selectedCount} Selected Changes</span>
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

