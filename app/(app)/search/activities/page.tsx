"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  MapPin,
  DollarSign,
  Clock,
  Star,
  Compass,
  Layers,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  X,
  Route,
  Calendar,
  RefreshCw,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Activity {
  id: string;
  title: string;
  city_name?: string;
  country?: string;
  description?: string;
  category: string;
  estimated_cost: number;
  currency: string;
  duration_minutes: number;
  rating?: number;
  address?: string;
  image_url?: string;
}

interface UserTrip {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  currency?: string | null;
}

interface TripStopOption {
  id: string;
  name: string;
}

type CostFilter = "All" | "Free" | "Under $30" | "$30+";
type DurationFilter = "All" | "Under 1 hour" | "1–3 hours" | "Half-day+";

const COST_OPTIONS: CostFilter[] = ["All", "Free", "Under $30", "$30+"];
const DURATION_OPTIONS: DurationFilter[] = [
  "All",
  "Under 1 hour",
  "1–3 hours",
  "Half-day+",
];

function SearchActivitiesContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const cityParam = searchParams.get("city") || "";

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState(cityParam);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedCost, setSelectedCost] = useState<CostFilter>("All");
  const [selectedDuration, setSelectedDuration] = useState<DurationFilter>("All");

  // Modal State for "Add to Trip"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedActivityForModal, setSelectedActivityForModal] = useState<Activity | null>(null);
  const [userTrips, setUserTrips] = useState<UserTrip[]>([]);
  const [stopsByTrip, setStopsByTrip] = useState<Record<string, TripStopOption[]>>({});
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedStopId, setSelectedStopId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function loadActivities(showRefreshing = false) {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await fetch("/api/activities", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error("Failed to load activities", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    if (cityParam) {
      setSelectedCity(cityParam);
    }
  }, [cityParam]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const categories = [
    "All",
    ...Array.from(new Set(activities.map((a) => a.category).filter(Boolean))),
  ];

  const filteredActivities = activities.filter((act) => {
    // 1. Text Search query
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      act.title.toLowerCase().includes(q) ||
      (act.city_name && act.city_name.toLowerCase().includes(q)) ||
      (act.country && act.country.toLowerCase().includes(q)) ||
      (act.description && act.description.toLowerCase().includes(q));

    // 2. City Filter (pre-filtered via ?city= URL param)
    const matchesCity =
      !selectedCity ||
      (act.city_name &&
        act.city_name.toLowerCase().includes(selectedCity.toLowerCase())) ||
      (act.country &&
        act.country.toLowerCase().includes(selectedCity.toLowerCase()));

    // 3. Category Filter
    const matchesCategory =
      selectedCategory === "All" || act.category === selectedCategory;

    // 4. Cost Filter: All, Free, Under $30, $30+
    let matchesCost = true;
    const cost = Number(act.estimated_cost) || 0;
    if (selectedCost === "Free") {
      matchesCost = cost === 0;
    } else if (selectedCost === "Under $30") {
      matchesCost = cost < 30;
    } else if (selectedCost === "$30+") {
      matchesCost = cost >= 30;
    }

    // 5. Duration Filter: All, Under 1 hour, 1–3 hours, Half-day+
    let matchesDuration = true;
    const duration = Number(act.duration_minutes) || 0;
    if (selectedDuration === "Under 1 hour") {
      matchesDuration = duration < 60;
    } else if (selectedDuration === "1–3 hours") {
      matchesDuration = duration >= 60 && duration <= 180;
    } else if (selectedDuration === "Half-day+") {
      matchesDuration = duration > 180;
    }

    return (
      matchesSearch &&
      matchesCity &&
      matchesCategory &&
      matchesCost &&
      matchesDuration
    );
  });

  const hasActiveFilters =
    Boolean(selectedCity) ||
    selectedCategory !== "All" ||
    selectedCost !== "All" ||
    selectedDuration !== "All" ||
    Boolean(searchQuery);

  function resetAllFilters() {
    setSelectedCategory("All");
    setSelectedCost("All");
    setSelectedDuration("All");
    setSelectedCity("");
    setSearchQuery("");
  }

  // Open "Add to Trip" Modal
  async function handleOpenAddModal(act: Activity) {
    setSelectedActivityForModal(act);
    setIsModalOpen(true);
    setModalError(null);
    setLoadingTrips(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserTrips([]);
        setLoadingTrips(false);
        return;
      }

      // Fetch user's trips from Supabase (trips table)
      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("id, title, start_date, end_date, currency")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (tripsError || !tripsData) {
        setUserTrips([]);
        setLoadingTrips(false);
        return;
      }

      setUserTrips(tripsData);

      if (tripsData.length > 0) {
        const defaultTrip =
          tripId && tripsData.some((t) => t.id === tripId)
            ? tripId
            : tripsData[0].id;

        setSelectedTripId(defaultTrip);
        setSelectedDay(1);
        setSelectedStopId("");

        const tripIds = tripsData.map((t) => t.id);
        const newStopsMap: Record<string, TripStopOption[]> = {};

        // Fetch stops from trip_stops table
        const { data: tripStopsData } = await supabase
          .from("trip_stops")
          .select("id, trip_id, custom_city_name, order_index")
          .in("trip_id", tripIds);

        if (tripStopsData && tripStopsData.length > 0) {
          tripStopsData.forEach((s) => {
            if (!newStopsMap[s.trip_id]) newStopsMap[s.trip_id] = [];
            newStopsMap[s.trip_id].push({
              id: s.id,
              name: s.custom_city_name || "Destination Stop",
            });
          });
        } else {
          // Fallback to stops table if trip_stops was empty
          const { data: stopsData } = await supabase
            .from("stops")
            .select("id, trip_id, name, custom_city_name, order_index")
            .in("trip_id", tripIds);

          if (stopsData && stopsData.length > 0) {
            stopsData.forEach((s) => {
              if (!newStopsMap[s.trip_id]) newStopsMap[s.trip_id] = [];
              newStopsMap[s.trip_id].push({
                id: s.id,
                name: s.name || s.custom_city_name || "Destination Stop",
              });
            });
          }
        }

        setStopsByTrip(newStopsMap);
      }
    } catch (err) {
      console.error("Error loading user trips:", err);
      setUserTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }

  // Confirm and insert record into stop_activities or itinerary_items
  async function handleConfirmAddToTrip() {
    if (!selectedActivityForModal || !selectedTripId) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      const supabase = createClient();
      let recordInserted = false;

      // 1. Insert into itinerary_items (the normalized table for scheduled activities)
      const isFallbackActivity =
        selectedActivityForModal.id.startsWith("fallback-") ||
        Boolean((selectedActivityForModal as unknown as { is_fallback?: boolean }).is_fallback);
      const safeActivityId = isFallbackActivity ? null : selectedActivityForModal.id;

      const { error: itemErr } = await supabase
        .from("itinerary_items")
        .insert({
          trip_id: selectedTripId,
          trip_stop_id: selectedStopId || null,
          activity_id: safeActivityId,
          day_number: selectedDay || 1,
          title: selectedActivityForModal.title,
          description: selectedActivityForModal.description || null,
          category: selectedActivityForModal.category || "Sightseeing",
          estimated_cost: selectedActivityForModal.estimated_cost || 0,
          currency: selectedActivityForModal.currency || "USD",
          order_index: 0,
        });

      if (!itemErr) {
        recordInserted = true;
      }

      // 2. Fallback to API route if direct insert encountered permission issues
      if (!recordInserted) {
        const res = await fetch(`/api/trips/${selectedTripId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: selectedActivityForModal.title,
            description: selectedActivityForModal.description,
            category: selectedActivityForModal.category,
            estimated_cost: selectedActivityForModal.estimated_cost,
            day_number: selectedDay || 1,
            trip_stop_id: selectedStopId || null,
            activity_id: safeActivityId,
          }),
        });

        if (res.ok) {
          recordInserted = true;
        }
      }

      if (recordInserted) {
        const targetTrip = userTrips.find((t) => t.id === selectedTripId);
        const tripName = targetTrip?.title || "your trip";
        setToastMessage(
          `Added "${selectedActivityForModal.title}" to ${tripName} (Day ${selectedDay})!`
        );
        setIsModalOpen(false);
      } else {
        setModalError("Unable to save activity to this trip. Please try again.");
      }
    } catch (err: unknown) {
      setModalError(
        err instanceof Error ? err.message : "Failed to add activity to trip."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Calculate days for currently selected trip
  const currentSelectedTrip = userTrips.find((t) => t.id === selectedTripId);
  const totalDaysForSelectedTrip = (() => {
    if (!currentSelectedTrip?.start_date || !currentSelectedTrip?.end_date) {
      return 5;
    }
    const s = new Date(currentSelectedTrip.start_date);
    const e = new Date(currentSelectedTrip.end_date);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return 5;
    }
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  })();

  const currentStopsForTrip = selectedTripId ? stopsByTrip[selectedTripId] || [] : [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {tripId ? (
              <Link
                href={`/trips/${tripId}/builder`}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Builder
              </Link>
            ) : (
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Compass className="h-4 w-4" />
                </div>
                <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
              </Link>
            )}
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-600">Explore Activities</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing || loading}
              onClick={() => loadActivities(true)}
              className="gap-1.5 text-xs text-slate-600 hover:text-slate-900"
              title="Refresh activities catalog"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Link href={tripId ? `/search/cities?tripId=${tripId}` : "/search/cities"}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" />
                Browse Cities
              </Button>
            </Link>
            {tripId ? (
              <Link href={`/trips/${tripId}/builder`}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Return to Builder
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        {tripId && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                Adding activities to your trip itinerary. Click <strong>&quot;Add to Itinerary&quot;</strong> on any item to schedule it into your trip.
              </span>
            </div>
            <Link href={`/trips/${tripId}/builder`}>
              <Button size="sm" className="text-xs h-7 bg-blue-600 text-white">
                View Builder
              </Button>
            </Link>
          </div>
        )}

        {/* Title & Search */}
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-xs">
            Curated Global Activities
          </Badge>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Explore Things to Do
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Browse top-rated tours, museums, dining experiences, and outdoor adventures by category, cost, and duration.
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] text-slate-500 shadow-2xs">
            <Info className="h-3 w-3 text-slate-400 shrink-0" />
            <span>Curated catalog experiences. Personal activities created within individual trips remain private to those itineraries.</span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search activities by name, destination, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white text-sm shadow-xs border-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Comprehensive Filter Controls */}
        <div className="mx-auto mt-6 max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="space-y-3.5">
            {/* Category Filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-xs font-semibold text-slate-600 sm:w-20 shrink-0">
                Category:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      selectedCategory === cat
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-600 sm:w-20 shrink-0 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                Cost:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COST_OPTIONS.map((costOption) => (
                  <button
                    key={costOption}
                    type="button"
                    onClick={() => setSelectedCost(costOption)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      selectedCost === costOption
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {costOption}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-600 sm:w-20 shrink-0 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                Duration:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map((durOption) => (
                  <button
                    key={durOption}
                    type="button"
                    onClick={() => setSelectedDuration(durOption)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      selectedDuration === durOption
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {durOption}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Filters Summary & Reset */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Active filters:</span>
                  {selectedCity && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                      <MapPin className="h-3 w-3" />
                      Destination: {selectedCity}
                      <button
                        type="button"
                        onClick={() => setSelectedCity("")}
                        className="ml-1 text-blue-400 hover:text-blue-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {selectedCategory !== "All" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      Category: {selectedCategory}
                      <button
                        type="button"
                        onClick={() => setSelectedCategory("All")}
                        className="ml-1 text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {selectedCost !== "All" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                      Cost: {selectedCost}
                      <button
                        type="button"
                        onClick={() => setSelectedCost("All")}
                        className="ml-1 text-emerald-400 hover:text-emerald-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {selectedDuration !== "All" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
                      Duration: {selectedDuration}
                      <button
                        type="button"
                        onClick={() => setSelectedDuration("All")}
                        className="ml-1 text-indigo-400 hover:text-indigo-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      Keyword: &quot;{searchQuery}&quot;
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="ml-1 text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-[11px] font-medium text-slate-500 hover:text-blue-600 underline"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Activities Grid */}
        <div className="mt-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-3 text-sm">Loading curated activities...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
              <Layers className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-2 text-sm font-semibold text-slate-900">No activities match your filters</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Try loosening your category, cost, or duration constraints to see more options.
              </p>
              {hasActiveFilters && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetAllFilters}
                    className="text-xs"
                  >
                    Reset all filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredActivities.map((act) => (
                <Card
                  key={act.id}
                  className="group flex flex-col justify-between overflow-hidden border-slate-200 bg-white transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <div>
                    <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                      <img
                        src={
                          act.image_url ||
                          "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80"
                        }
                        alt={act.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <Badge className="bg-slate-900/80 text-white text-[10px] font-semibold backdrop-blur-sm shadow-sm">
                          {act.category}
                        </Badge>
                      </div>
                      {act.rating && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-sm">
                          <Star className="h-3 w-3 fill-amber-300" />
                          <span>{act.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-5">
                      {act.city_name && (
                        <div className="flex items-center gap-1 text-xs font-medium text-blue-600 mb-1">
                          <MapPin className="h-3 w-3" />
                          {act.city_name} {act.country ? `• ${act.country}` : ""}
                        </div>
                      )}

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {act.title}
                      </h3>

                      {act.description && (
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {act.description}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
                        >
                          <DollarSign className="h-3 w-3" />
                          {act.estimated_cost === 0
                            ? "Free Activity"
                            : `$${Number(act.estimated_cost).toFixed(0)} est.`}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-slate-100 text-slate-700 text-xs"
                        >
                          <Clock className="h-3 w-3 text-slate-500" />
                          {Number(act.duration_minutes) >= 60
                            ? `${Math.floor(Number(act.duration_minutes) / 60)}h ${
                                Number(act.duration_minutes) % 60
                                  ? `${Number(act.duration_minutes) % 60}m`
                                  : ""
                              }`
                            : `${act.duration_minutes || 0} min`}
                        </Badge>
                      </div>
                    </CardContent>
                  </div>

                  <div className="p-5 pt-0">
                    <Button
                      onClick={() => handleOpenAddModal(act)}
                      className="w-full text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Add to Itinerary
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* "Add to Trip" Modal */}
      {isModalOpen && selectedActivityForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add to Trip</h3>
                <p className="text-xs text-slate-500">
                  Schedule &quot;{selectedActivityForModal.title}&quot; into your travel plans.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message if present */}
            {modalError && (
              <div className="mx-6 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                {modalError}
              </div>
            )}

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingTrips ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="mt-2 text-xs">Loading your trips...</span>
                </div>
              ) : userTrips.length === 0 ? (
                /* Empty state when user has no active trips */
                <div className="py-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
                    <Route className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">No active trips found</h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    You haven&apos;t created any trips yet. Create a trip first to start scheduling activities.
                  </p>
                  <div className="mt-5">
                    <Link href="/trips/new">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
                        Create a Trip First
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                /* Form to pick Trip, Day, and Stop */
                <div className="space-y-4">
                  {/* Trip Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Select Trip:
                    </label>
                    <select
                      value={selectedTripId}
                      onChange={(e) => {
                        setSelectedTripId(e.target.value);
                        setSelectedDay(1);
                        setSelectedStopId("");
                      }}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-xs focus:border-blue-400 focus:outline-hidden"
                    >
                      {userTrips.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} {t.start_date ? `(${t.start_date})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Day Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Trip Day:
                    </label>
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(Number(e.target.value))}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-xs focus:border-blue-400 focus:outline-hidden"
                    >
                      {Array.from({ length: totalDaysForSelectedTrip }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Day {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stop Selector (if stops exist) */}
                  {currentStopsForTrip.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Destination Stop (Optional):
                      </label>
                      <select
                        value={selectedStopId}
                        onChange={(e) => setSelectedStopId(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 shadow-xs focus:border-blue-400 focus:outline-hidden"
                      >
                        <option value="">No specific stop</option>
                        {currentStopsForTrip.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Activity Summary Info */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-600 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 block truncate max-w-[240px]">
                        {selectedActivityForModal.title}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {selectedActivityForModal.category}
                      </span>
                    </div>
                    <span className="font-bold text-emerald-600">
                      {selectedActivityForModal.estimated_cost === 0
                        ? "Free"
                        : `$${Number(selectedActivityForModal.estimated_cost).toFixed(0)}`}
                    </span>
                  </div>

                  {/* Modal Action Buttons */}
                  <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsModalOpen(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={isSubmitting || !selectedTripId}
                      onClick={handleConfirmAddToTrip}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                    >
                      {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900 text-white px-4 py-3 shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchActivitiesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <SearchActivitiesContent />
    </Suspense>
  );
}
