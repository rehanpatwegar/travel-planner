"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function NewTripPage() {
  const router = useRouter();
  const supabase = createClient();

  // Form states
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");

  // Submission & feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successTripId, setSuccessTripId] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Validation
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg("Please enter a name for your trip.");
      return;
    }

    if (startDate && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        setErrorMsg("Trip end date must be on or after the start date.");
        return;
      }
    }

    const budgetVal = totalBudget ? parseFloat(totalBudget) : 0;
    if (isNaN(budgetVal) || budgetVal < 0) {
      setErrorMsg("Please enter a valid, non-negative budget amount.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Obtain authenticated user identity securely
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setErrorMsg("Your session has expired. Please sign in again.");
        router.push("/login?redirect=/trips/new");
        return;
      }

      // 3. Insert trip into Supabase `trips` table respecting RLS
      const { data: trip, error: insertError } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          title: trimmedTitle,
          description: description.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          total_budget: budgetVal,
          currency: currency.trim().toUpperCase() || "USD",
        })
        .select()
        .single();

      if (insertError || !trip) {
        throw new Error(insertError?.message || "Failed to create trip.");
      }

      // 4. If an initial destination/city was provided, create the initial stop in `trip_stops`
      const trimmedDest = destination.trim();
      if (trimmedDest) {
        const { error: stopError } = await supabase.from("trip_stops").insert({
          trip_id: trip.id,
          custom_city_name: trimmedDest,
          order_index: 0,
          arrival_date: startDate || null,
          departure_date: endDate || null,
        });

        if (stopError) {
          console.warn("Could not attach initial stop:", stopError.message);
        }
      }

      // 5. Success feedback and redirect
      setSuccessTripId(trip.id);
      setTimeout(() => {
        router.push(`/trips/${trip.id}/builder`);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while creating the trip.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Compass className="h-4 w-4" />
              </div>
              <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-600">Create New Trip</span>
          </div>

          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
              Trip Setup
            </Badge>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              Plan a New Journey
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Configure your trip parameters. You can add stops and organize activities in the next step.
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <p>{errorMsg}</p>
            </div>
          )}

          {successTripId && (
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <p>Trip created successfully! Redirecting to itinerary builder...</p>
            </div>
          )}

          {/* Form Card */}
          <Card className="mt-6 border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Trip Details</CardTitle>
              <CardDescription className="text-xs">
                Fill in the basic parameters for your upcoming journey.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Trip Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Trip Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Western Europe Explorer, Tokyo Culinary Tour"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isSubmitting}
                    className="h-10 text-sm"
                  />
                </div>

                {/* Initial Destination / City */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Primary Destination or Initial City
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="e.g. Paris, France or Lucerne, Switzerland"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      disabled={isSubmitting}
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Additional multi-city stops can be added in the itinerary builder.
                  </p>
                </div>

                {/* Travel Dates */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Start Date</label>
                    <div className="relative">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Budget and Currency */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">
                      Estimated Total Budget
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        placeholder="2500"
                        value={totalBudget}
                        onChange={(e) => setTotalBudget(e.target.value)}
                        disabled={isSubmitting}
                        className="pl-9 h-10 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Currency</label>
                    <Input
                      maxLength={3}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      disabled={isSubmitting}
                      className="h-10 text-sm uppercase"
                    />
                  </div>
                </div>

                {/* Description & Travel Interests */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Travel Interests & Notes
                  </label>
                  <Textarea
                    placeholder="e.g. Focus on historic architecture, scenic rail journeys, local dining, and museum tours..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting}
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    Stored in the trip description to contextualize your planning notes.
                  </p>
                </div>

                {/* Form Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <Link href="/dashboard">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 font-medium"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Saving Trip...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Create Trip
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
