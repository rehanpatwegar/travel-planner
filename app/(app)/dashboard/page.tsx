"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  Plus,
  MapPin,
  Calendar,
  DollarSign,
  Route,
  Sparkles,
  ArrowRight,
  Layers,
  Search,
  Loader2,
  AlertCircle,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TripStop {
  id: string;
  custom_city_name: string | null;
}

interface Trip {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: number;
  currency: string;
  created_at: string;
  trip_stops?: TripStop[];
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userName, setUserName] = useState<string>("Traveler");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadDashboardData() {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Authenticated user identity
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login?redirect=/dashboard");
        return;
      }

      // 2. Fetch user profile for personalized greeting
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile?.full_name) {
        setUserName(profile.full_name);
      } else if (user.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      } else if (user.email) {
        setUserName(user.email.split("@")[0]);
      }

      // 3. Fetch real user trips from Supabase
      const { data: userTrips, error: tripsError } = await supabase
        .from("trips")
        .select("*, trip_stops(id, custom_city_name)")
        .order("created_at", { ascending: false });

      if (tripsError) {
        throw new Error(tripsError.message);
      }

      setTrips(userTrips || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard data.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Compute summary metrics based on real database data
  const totalTripsCount = trips.length;

  const totalBudgetSum = trips.reduce((acc, t) => acc + (Number(t.total_budget) || 0), 0);

  const allStops = trips.flatMap((t) => (t.trip_stops || []).map((s) => s.custom_city_name).filter(Boolean));
  const uniqueStopsCount = new Set(allStops).size;

  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingTripsCount = trips.filter(
    (t) => !t.end_date || t.end_date >= todayStr
  ).length;

  function formatDateRange(startDate: string | null, endDate: string | null) {
    if (!startDate && !endDate) return "Dates flexible";
    if (startDate && !endDate) return `Starting ${startDate}`;
    if (!startDate && endDate) return `Until ${endDate}`;
    return `${startDate} – ${endDate}`;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Compass className="h-4 w-4" />
              </div>
              <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-600">Travel Dashboard</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/search/cities">
              <Button variant="ghost" size="sm" className="text-xs">
                <Search className="mr-1.5 h-3.5 w-3.5" />
                Find Cities
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="text-xs">
                Profile
              </Button>
            </Link>
            <Link href="/trips/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                New Trip
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Error State Banner */}
        {errorMsg && (
          <div className="mb-6 flex items-start justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <p>{errorMsg}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              className="text-xs h-7 border-rose-300 bg-white"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Personalized Welcome Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome back, {userName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage multi-city itineraries, customize day schedules, and monitor travel budgets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/trips">
              <Button variant="outline" size="sm" className="text-xs">
                View All Trips ({totalTripsCount})
              </Button>
            </Link>
            <Link href="/trips/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
                <Plus className="h-4 w-4" />
                Create Trip
              </Button>
            </Link>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-xs font-medium">Loading your dashboard...</p>
          </div>
        ) : (
          <>
            {/* Real Database Summary Stats */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-slate-500">Total Trips</CardTitle>
                  <Route className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{totalTripsCount}</div>
                  <p className="text-xs text-slate-500 mt-1">Multi-city travel plans</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-slate-500">Upcoming Trips</CardTitle>
                  <Calendar className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{upcomingTripsCount}</div>
                  <p className="text-xs text-slate-500 mt-1">Active or future itineraries</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-slate-500">Destinations</CardTitle>
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{uniqueStopsCount}</div>
                  <p className="text-xs text-slate-500 mt-1">Planned city stops</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-slate-500">Planned Budget</CardTitle>
                  <DollarSign className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">
                    ${totalBudgetSum.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Across all planned trips</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Trips Section */}
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Recent Itineraries</h2>
                {trips.length > 0 && (
                  <Link href="/trips" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                    View All ({trips.length}) →
                  </Link>
                )}
              </div>

              {trips.length === 0 ? (
                /* Empty State */
                <Card className="border-dashed border-slate-300 bg-white p-8 text-center shadow-xs">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
                    <Route className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">No trips created yet</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    Start planning your first journey. Add multi-city stops, structure daily activities, and manage your budget.
                  </p>
                  <div className="mt-5">
                    <Link href="/trips/new">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
                        <Plus className="h-4 w-4" />
                        Create Your First Trip
                      </Button>
                    </Link>
                  </div>
                </Card>
              ) : (
                /* Recent Trips Grid */
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {trips.slice(0, 4).map((trip) => {
                    const stops = (trip.trip_stops || []).map((s) => s.custom_city_name).filter(Boolean);
                    const stopsLabel = stops.length > 0 ? stops.join(" → ") : "No stops added yet";

                    return (
                      <Card
                        key={trip.id}
                        className="overflow-hidden border-slate-200 bg-white transition-all hover:border-blue-200 hover:shadow-md"
                      >
                        <div className="h-32 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 text-white flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <Badge className="bg-white/20 text-white border-0 text-[10px]">
                              {stops.length > 0 ? `${stops.length} ${stops.length === 1 ? "Stop" : "Stops"}` : "Trip Draft"}
                            </Badge>
                            <span className="text-[11px] text-blue-100 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateRange(trip.start_date, trip.end_date)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-bold text-lg leading-tight line-clamp-1">{trip.title}</h3>
                            <p className="text-[11px] text-blue-100 line-clamp-1 mt-0.5">{stopsLabel}</p>
                          </div>
                        </div>

                        <CardContent className="p-4">
                          <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
                            <span>
                              Budget:{" "}
                              <strong className="text-slate-900 font-semibold">
                                ${trip.total_budget.toLocaleString()} {trip.currency}
                              </strong>
                            </span>
                            {trip.description && (
                              <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[140px]">
                                {trip.description}
                              </span>
                            )}
                          </div>

                          <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                            <Link href={`/trips/${trip.id}/builder`}>
                              <Button variant="outline" size="sm" className="w-full text-xs h-8">
                                Itinerary Builder
                              </Button>
                            </Link>
                            <Link href={`/trips/${trip.id}/view`}>
                              <Button variant="outline" size="sm" className="w-full text-xs h-8">
                                View Plan
                              </Button>
                            </Link>
                            <Link href={`/trips/${trip.id}/budget`}>
                              <Button variant="outline" size="sm" className="w-full text-xs h-8">
                                Budget
                              </Button>
                            </Link>
                            <Link href={`/trips/${trip.id}/calendar`}>
                              <Button variant="outline" size="sm" className="w-full text-xs h-8">
                                Calendar
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Planning Shortcuts */}
            <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Compass className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Explore & Discover</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Link
                  href="/search/cities"
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-blue-50/50 hover:border-blue-200"
                >
                  <div className="font-semibold text-sm text-slate-900">Explore Cities</div>
                  <p className="text-xs text-slate-500 mt-1">Browse curated destinations and regional average daily costs.</p>
                </Link>

                <Link
                  href="/search/activities"
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-blue-50/50 hover:border-blue-200"
                >
                  <div className="font-semibold text-sm text-slate-900">Browse Activities</div>
                  <p className="text-xs text-slate-500 mt-1">Filter attractions by category, cost, and time duration.</p>
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
