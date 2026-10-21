"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Compass,
  Clock,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Info,
  ShieldAlert,
  Loader2,
  Trash2,
  Check,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AITripDraft, AIGeneratedDay } from "@/lib/ai/generator";

const INTEREST_OPTIONS = [
  { id: "Sightseeing", label: "Sightseeing", icon: "📸" },
  { id: "Culture & History", label: "Culture & History", icon: "🏛️" },
  { id: "Food & Dining", label: "Food & Dining", icon: "🍽️" },
  { id: "Nature", label: "Nature & Parks", icon: "🌲" },
  { id: "Adventure", label: "Adventure & Outdoors", icon: "🧗" },
  { id: "Relaxation", label: "Relaxation & Wellness", icon: "💆" },
  { id: "Shopping", label: "Local Markets & Shopping", icon: "🛍️" },
  { id: "Entertainment", label: "Arts & Entertainment", icon: "🎭" },
];

const PACE_OPTIONS = [
  {
    id: "relaxed",
    label: "Relaxed",
    description: "1–2 key activities per day, generous downtime and casual wandering",
  },
  {
    id: "moderate",
    label: "Moderate",
    description: "2–3 activities per day, well-balanced exploration and meals",
  },
  {
    id: "fast-paced",
    label: "Fast-Paced",
    description: "3–4 activities per day, maximize sights and packed schedules",
  },
] as const;

const POPULAR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "INR"];

interface AITripGeneratorWizardProps {
  onSwitchToManual: () => void;
}

export function AITripGeneratorWizard({ onSwitchToManual }: AITripGeneratorWizardProps) {
  const router = useRouter();

  // Wizard state: "form" | "generating" | "review"
  const [step, setStep] = useState<"form" | "generating" | "review">("form");

  // Form inputs
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [interests, setInterests] = useState<string[]>([
    "Sightseeing",
    "Culture & History",
    "Food & Dining",
  ]);
  const [pace, setPace] = useState<"relaxed" | "moderate" | "fast-paced">("moderate");
  const [travelersCount, setTravelersCount] = useState<number>(2);
  const [preferences, setPreferences] = useState("");

  // Generation & Draft State
  const [draft, setDraft] = useState<AITripDraft | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeDayTab, setActiveDayTab] = useState<number>(1);

  // Toggle interest
  const toggleInterest = (interestId: string) => {
    setInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((i) => i !== interestId)
        : [...prev, interestId]
    );
  };

  // Trigger AI Generation
  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorMsg(null);

    // Validation
    const trimmedDest = destination.trim();
    if (!trimmedDest) {
      setErrorMsg("Please enter at least one destination city or country.");
      return;
    }

    if (startDate && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        setErrorMsg("Trip end date must be on or after the start date.");
        return;
      }
    }

    setStep("generating");

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: trimmedDest,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          totalBudget: totalBudget ? parseFloat(totalBudget) : 0,
          currency: currency.trim().toUpperCase() || "USD",
          interests,
          pace,
          travelersCount: Math.max(1, travelersCount),
          preferences: preferences.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Generation failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.draft || !Array.isArray(data.draft.days)) {
        throw new Error("Received invalid itinerary draft format from server.");
      }

      setDraft(data.draft);
      setActiveDayTab(1);
      setStep("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(msg);
      setStep("form");
    }
  }

  // Confirm and Save Draft to Database
  async function handleConfirmAndSave() {
    if (!draft) return;
    setErrorMsg(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Save failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.tripId) {
        throw new Error("Save completed but no trip ID was returned.");
      }

      // Smooth transition to Itinerary Builder
      router.push(`/trips/${data.tripId}/builder`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save itinerary.";
      setErrorMsg(msg);
      setIsSaving(false);
    }
  }

  return (
    <div className="w-full">
      {/* Step 1: Input Form */}
      {step === "form" && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900">
                    AI Travel Generator
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Tell us your vision, and Gemini AI will curate a complete day-by-day plan.
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSwitchToManual}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Switch to Manual Setup
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {errorMsg && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <p>{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-5">
              {/* Destination(s) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Destination(s) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="e.g. Rome & Florence, Italy or Tokyo, Japan"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  You can specify a single city or multiple cities separated by commas.
                </p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Start Date</label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">End Date</label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Budget & Currency */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Total Estimated Budget
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      placeholder="e.g. 2000"
                      value={totalBudget}
                      onChange={(e) => setTotalBudget(e.target.value)}
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    AI will check if recommended activities fit within this budget.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    {POPULAR_CURRENCIES.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pacing & Travelers */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Pacing */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Travel Style & Pace
                  </label>
                  <div className="space-y-2">
                    {PACE_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        onClick={() => setPace(opt.id)}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                          pace === opt.id
                            ? "border-blue-600 bg-blue-50/50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="pace"
                          checked={pace === opt.id}
                          onChange={() => setPace(opt.id)}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-slate-800">{opt.label}</span>
                          <p className="text-[11px] text-slate-500">{opt.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Travelers Count & Preferences */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Number of Travelers
                    </label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={travelersCount <= 1}
                        onClick={() => setTravelersCount((c) => Math.max(1, c - 1))}
                        className="h-10 w-10 p-0 text-base"
                      >
                        -
                      </Button>
                      <div className="flex h-10 flex-1 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
                        <Users className="mr-2 h-4 w-4 text-slate-500" />
                        {travelersCount} {travelersCount === 1 ? "Traveler" : "Travelers"}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={travelersCount >= 16}
                        onClick={() => setTravelersCount((c) => Math.min(16, c + 1))}
                        className="h-10 w-10 p-0 text-base"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Special Preferences or Accessibility (Optional)
                    </label>
                    <Textarea
                      placeholder="e.g. Wheelchair accessible sights, vegetarian food focus, avoid early mornings..."
                      value={preferences}
                      onChange={(e) => setPreferences(e.target.value)}
                      rows={3}
                      className="text-xs resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Travel Interests (Multi-Select) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Travel Interests & Themes
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {interests.length} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((item) => {
                    const isSelected = interests.includes(item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleInterest(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-600 ring-offset-1"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                        {isSelected && <Check className="ml-1 h-3 w-3 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSwitchToManual}
                  className="text-xs text-slate-600"
                >
                  Manual Setup
                </Button>

                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-10 font-semibold px-5 shadow-sm"
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Generate Itinerary with AI
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Generating Loader */}
      {step === "generating" && (
        <Card className="border-indigo-100 bg-white shadow-md text-center py-16 px-6">
          <CardContent className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-inner">
              <Sparkles className="h-8 w-8 animate-pulse text-indigo-600" />
              <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400/30 animate-ping" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">
                Crafting Your Custom Itinerary
              </h3>
              <p className="text-xs text-slate-500">
                AI is researching attractions in <span className="font-semibold text-slate-700">{destination}</span>, scheduling daily timing, estimating activity fees, and balancing your {pace} pace.
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                <span>Generating structured recommendations...</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-indigo-600 rounded-full animate-pulse" />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 pt-3">
              This usually takes 3 to 10 seconds. You will be able to review, adjust, and customize everything before saving.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Draft Review & Save */}
      {step === "review" && draft && (
        <div className="space-y-6">
          {/* Draft Header Summary */}
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white text-[11px] font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Draft Proposal
                  </Badge>
                  {draft.source === "gemini" ? (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]">
                      Powered by Gemini
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]">
                      Heuristic Engine
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("form")}
                    className="text-xs h-8"
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Edit Preferences
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerate()}
                    className="text-xs h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  >
                    <RotateCw className="mr-1 h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="mt-3">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {draft.tripTitle}
                </h2>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                  {draft.description}
                </p>
              </div>

              {/* Trip Quick Stats */}
              <div className="mt-3.5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {draft.startDate} to {draft.endDate} ({draft.totalDays} Days)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{draft.destinations.join(", ")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>{travelersCount} Traveler(s)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="capitalize">{pace} Pace</span>
                </div>
              </div>
            </div>

            {/* Budget Assessment Card */}
            <div className="px-6 py-4 bg-white border-b border-slate-100">
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-800">
                      Budget Feasibility Assessment
                    </span>
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]">
                      Preliminary (Activities Only)
                    </Badge>
                    {draft.budgetAssessment.status === "comfortable" && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                        Comfortable Activity Buffer
                      </Badge>
                    )}
                    {draft.budgetAssessment.status === "within_budget" && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                        Activities Within Budget
                      </Badge>
                    )}
                    {draft.budgetAssessment.status === "exceeds_budget" && (
                      <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]">
                        Attention: Activities Exceed Target
                      </Badge>
                    )}
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-slate-500">Estimated Total Activities: </span>
                    <span className="font-bold text-slate-900">
                      {draft.currency}{" "}
                      {draft.budgetAssessment.totalEstimatedCost.toLocaleString()}
                    </span>
                    {draft.targetBudget > 0 && (
                      <span className="text-slate-500">
                        {" "}
                        / Target: {draft.currency} {draft.targetBudget.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {draft.budgetAssessment.advice}
                </p>

                {draft.budgetAssessment.missingCategories && draft.budgetAssessment.missingCategories.length > 0 && (
                  <div className="mt-2.5 rounded border border-amber-200/80 bg-amber-50/70 p-2 text-[11px] text-amber-800">
                    <span className="font-medium">Missing Categories: </span>
                    {draft.budgetAssessment.missingCategories.join(", ")} are not included in this preliminary estimate. Remember to budget separately for lodging and long-distance travel.
                  </div>
                )}
              </div>

              {/* Mandatory AI Estimate Disclaimer */}
              <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
                <p>{draft.disclaimer}</p>
              </div>
            </div>

            {/* Day Selector Tabs */}
            <div className="px-6 pt-4">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100">
                {draft.days.map((day) => {
                  const isActive = activeDayTab === day.dayNumber;
                  return (
                    <button
                      key={day.dayNumber}
                      type="button"
                      onClick={() => setActiveDayTab(day.dayNumber)}
                      className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Day {day.dayNumber}
                      {day.cityName ? ` • ${day.cityName}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Activities List */}
            <div className="px-6 py-5">
              {draft.days
                .filter((d) => d.dayNumber === activeDayTab)
                .map((day) => (
                  <div key={day.dayNumber} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Day {day.dayNumber}: {day.theme}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {day.date || "Date scheduled"} • Destination: {day.cityName}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {day.activities.length} planned activities
                      </span>
                    </div>

                    <div className="space-y-3">
                      {day.activities.map((act, actIdx) => (
                        <div
                          key={actIdx}
                          className="flex flex-col sm:flex-row items-start justify-between gap-3 rounded-lg border border-slate-200/80 bg-white p-3.5 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {act.title}
                              </span>
                              <Badge variant="outline" className="text-[10px] text-slate-600">
                                {act.category}
                              </Badge>
                              {act.startTime && (
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                  <Clock className="h-2.5 w-2.5" />
                                  {act.startTime} - {act.endTime}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-600">
                              {act.description}
                            </p>

                            {act.recommendationReason && (
                              <p className="text-[11px] text-indigo-600 italic">
                                &ldquo;{act.recommendationReason}&rdquo;
                              </p>
                            )}
                          </div>

                          <div className="text-right sm:self-center shrink-0">
                            <span className="text-xs font-bold text-slate-800">
                              {act.estimatedCost > 0
                                ? `${draft.currency} ${act.estimatedCost.toLocaleString()}`
                                : "Free Entry"}
                            </span>
                            <p className="text-[10px] text-slate-400">Est. cost</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Action Bar */}
            <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(null);
                  setStep("form");
                }}
                disabled={isSaving}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Discard Draft
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("form")}
                  disabled={isSaving}
                  className="text-xs"
                >
                  Edit Inputs
                </Button>

                <Button
                  type="button"
                  onClick={handleConfirmAndSave}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-semibold px-4 shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving to My Trips...
                    </>
                  ) : (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 stroke-[3]" />
                      Confirm & Save Itinerary
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
