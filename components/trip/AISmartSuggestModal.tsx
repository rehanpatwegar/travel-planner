"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  X,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  DollarSign,
  MapPin,
  Calendar,
  RotateCw,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trip, TripStop, ItineraryItem } from "./types";
import type { AITripDraft, AIGeneratedActivity } from "@/lib/ai/generator";

interface AISmartSuggestModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  stops: TripStop[];
  totalDays: number;
  totalPlannedCost: number;
  onSuccess: (newItems: ItineraryItem[]) => void;
}

interface SelectableActivity extends AIGeneratedActivity {
  dayNumber: number;
  selected: boolean;
}

export function AISmartSuggestModal({
  isOpen,
  onClose,
  trip,
  stops,
  totalDays,
  totalPlannedCost,
  onSuccess,
}: AISmartSuggestModalProps) {
  // Determine primary destination
  const primaryDest = useMemo(() => {
    const stopCity = stops.find((s) => s.custom_city_name || s.cities?.name);
    if (stopCity) {
      return stopCity.custom_city_name || stopCity.cities?.name || "";
    }
    // If trip title mentions destination, or fallback
    return trip.title || "Dubai";
  }, [stops, trip.title]);

  const remainingBudget = useMemo(() => {
    return Math.max(0, (Number(trip.total_budget) || 0) - totalPlannedCost);
  }, [trip.total_budget, totalPlannedCost]);

  // Form states
  const [destination, setDestination] = useState(primaryDest);
  const [budgetVal, setBudgetVal] = useState<string>(
    remainingBudget > 0 ? String(remainingBudget) : "1000"
  );
  const [pace, setPace] = useState<"relaxed" | "moderate" | "fast-paced">("moderate");

  // Suggestion results
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draftResult, setDraftResult] = useState<AITripDraft | null>(null);
  const [activitiesList, setActivitiesList] = useState<SelectableActivity[]>([]);

  // Update defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setDestination(primaryDest || "Dubai");
      setBudgetVal(remainingBudget > 0 ? String(remainingBudget) : "1000");
      setErrorMsg(null);
    }
  }, [isOpen, primaryDest, remainingBudget]);

  if (!isOpen) return null;

  async function handleFetchSuggestions() {
    setIsLoading(true);
    setErrorMsg(null);

    const safeDest = destination.trim() || primaryDest || "Dubai";

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: safeDest,
          startDate: trip.start_date || undefined,
          endDate: trip.end_date || undefined,
          totalBudget: parseFloat(budgetVal) || 0,
          currency: trip.currency || "USD",
          interests: ["Sightseeing", "Food & Dining", "Culture & History", "Adventure"],
          pace,
          travelersCount: 2,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate AI recommendations");
      }

      const { draft }: { draft: AITripDraft } = await res.json();
      setDraftResult(draft);

      // Flatten days into selectable items
      const flattened: SelectableActivity[] = [];
      (draft.days || []).forEach((day) => {
        (day.activities || []).forEach((act) => {
          flattened.push({
            ...act,
            dayNumber: day.dayNumber,
            selected: true,
          });
        });
      });

      setActivitiesList(flattened);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error querying Gemini API"
      );
    } finally {
      setIsLoading(false);
    }
  }

  function toggleActivity(index: number) {
    setActivitiesList((prev) =>
      prev.map((act, i) => (i === index ? { ...act, selected: !act.selected } : act))
    );
  }

  function toggleSelectAll(selectAll: boolean) {
    setActivitiesList((prev) =>
      prev.map((act) => ({ ...act, selected: selectAll }))
    );
  }

  const selectedActivities = activitiesList.filter((a) => a.selected);
  const selectedTotalCost = selectedActivities.reduce(
    (sum, a) => sum + (Number(a.estimatedCost) || 0),
    0
  );

  async function handleApplyToItinerary() {
    if (selectedActivities.length === 0) return;

    setIsApplying(true);
    setErrorMsg(null);

    try {
      // Find matching stop ID if available
      const defaultStopId = stops[0]?.id || null;

      const payload = {
        items: selectedActivities.map((act, idx) => ({
          title: act.title,
          description: act.description,
          category: act.category,
          day_number: act.dayNumber,
          order_index: idx,
          estimated_cost: act.estimatedCost,
          currency: trip.currency || "USD",
          start_time: act.startTime || null,
          end_time: act.endTime || null,
          notes: act.recommendationReason
            ? `AI Smart Suggest: ${act.recommendationReason}`
            : null,
          trip_stop_id: defaultStopId,
        })),
      };

      const res = await fetch(`/api/trips/${trip.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to apply activities to itinerary");
      }

      const { items: newCreatedItems } = await res.json();
      onSuccess(newCreatedItems || []);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error saving activities"
      );
      setIsApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  AI Smart Suggest & Auto-Fill
                </h3>
                <Badge
                  variant="outline"
                  className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]"
                >
                  Gemini AI
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Generate curated day-by-day activities tailored to your trip destination and budget.
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

        {/* Query Controls Banner */}
        <div className="border-b border-slate-100 bg-white px-6 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            {/* Destination */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Destination
              </label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Dubai, UAE"
                  className="h-8.5 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Remaining Budget */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Target Budget ({trip.currency || "USD"})
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={budgetVal}
                  onChange={(e) => setBudgetVal(e.target.value)}
                  placeholder="Budget"
                  className="h-8.5 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Pace */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600">
                Pacing
              </label>
              <select
                value={pace}
                onChange={(e) =>
                  setPace(e.target.value as "relaxed" | "moderate" | "fast-paced")
                }
                className="flex h-8.5 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
              >
                <option value="relaxed">Relaxed (1-2/day)</option>
                <option value="moderate">Moderate (2-3/day)</option>
                <option value="fast-paced">Fast-Paced (3-4/day)</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Planning for <strong className="text-slate-700">{totalDays} Days</strong>
                {trip.start_date ? ` (${trip.start_date})` : ""}
              </span>
            </div>

            <Button
              size="sm"
              onClick={handleFetchSuggestions}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-4 font-semibold shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {activitiesList.length > 0 ? "Regenerate" : "Generate AI Activities"}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body / Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Sparkles className="h-7 w-7 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Consulting Gemini AI for {destination}...
              </h4>
              <p className="text-xs text-slate-500 max-w-sm text-center">
                Generating structured activities tailored to {totalDays} days with realistic timings, categories, and estimated costs.
              </p>
            </div>
          )}

          {!isLoading && activitiesList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Sparkles className="h-6 w-6 text-indigo-600" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">
                Ready to Auto-Fill Your Itinerary
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Click &ldquo;Generate AI Activities&rdquo; to have Gemini suggest tailored sights, dining, and culture for {destination}.
              </p>
              <Button
                size="sm"
                onClick={handleFetchSuggestions}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 mt-2"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate Now
              </Button>
            </div>
          )}

          {!isLoading && activitiesList.length > 0 && (
            <div className="space-y-4">
              {/* Feasibility Assessment Pill */}
              {draftResult?.budgetAssessment && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-indigo-950">
                      {draftResult.budgetAssessment.status === "comfortable"
                        ? "Comfortable Budget Margin"
                        : draftResult.budgetAssessment.status === "within_budget"
                        ? "Within Target Budget"
                        : "Exceeds Target Budget"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-600">
                    Est. Total:{" "}
                    <strong>
                      {trip.currency || "USD"}{" "}
                      {draftResult.budgetAssessment.totalEstimatedCost.toLocaleString()}
                    </strong>
                  </span>
                </div>
              )}

              {/* Selection Bar */}
              <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {activitiesList.length} Proposed Activities
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-indigo-600 font-medium">
                    {selectedActivities.length} Selected
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-[11px] text-slate-500 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Activity Cards List */}
              <div className="space-y-2.5">
                {activitiesList.map((act, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleActivity(idx)}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      act.selected
                        ? "border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50"
                        : "border-slate-200 bg-white hover:bg-slate-50 opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={act.selected}
                      onChange={() => toggleActivity(idx)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />

                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-slate-100 border-slate-200 text-slate-700 font-semibold"
                        >
                          Day {act.dayNumber}
                        </Badge>
                        <span className="text-xs font-bold text-slate-900">
                          {act.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-slate-600"
                        >
                          {act.category}
                        </Badge>
                        {act.startTime && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="h-2.5 w-2.5" />
                            {act.startTime} - {act.endTime}
                          </span>
                        )}
                      </div>

                      {act.description && (
                        <p className="text-xs text-slate-600 leading-snug">
                          {act.description}
                        </p>
                      )}

                      {act.recommendationReason && (
                        <p className="text-[11px] text-indigo-600 italic">
                          &ldquo;{act.recommendationReason}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-900">
                        {act.estimatedCost > 0
                          ? `${trip.currency || "USD"} ${act.estimatedCost}`
                          : "Free"}
                      </span>
                      <p className="text-[10px] text-slate-400">Est. cost</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-1.5 pt-2 text-[10px] text-slate-400">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                <p>
                  Activity durations and ticket prices are estimates generated for planning. Verify real-time opening hours and bookings before travel.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-3.5 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isApplying}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleApplyToItinerary}
            disabled={selectedActivities.length === 0 || isApplying}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8.5 px-4 font-semibold shadow-xs"
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Applying to Itinerary...
              </>
            ) : (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5 stroke-[3]" />
                Apply to Itinerary ({selectedActivities.length})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

