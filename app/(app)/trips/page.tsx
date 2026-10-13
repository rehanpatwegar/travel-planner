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
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TripStop {
  id: string;
  custom_city_name: string | null;
  order_index: number;
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

export default function TripsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadUserTrips() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login?redirect=/trips");
        return;
      }

      // Fetch user's trips from Supabase with nested trip_stops
      const { data, error } = await supabase
        .from("trips")
        .select("*, trip_stops(id, custom_city_name, order_index)")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setTrips(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load your trips.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserTrips();
  }, []);

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
            <span className="text-sm font-medium text-slate-600">My Trips</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-xs">
                Dashboard
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

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Saved Trips
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage multi-city itineraries, customize day schedules, and monitor travel budgets.
            </p>
          </div>

          <Link href="/trips/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
              <Plus className="h-4 w-4" />
              Create Trip
            </Button>
          </Link>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="mt-6 flex items-start justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <p>{errorMsg}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadUserTrips}
              className="text-xs h-7 border-rose-300 bg-white"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-xs font-medium">Loading your itineraries...</p>
          </div>
        ) : trips.length === 0 ? (
          /* Empty State */
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Route className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">No trips planned yet</h3>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Start building your next adventure. Set multi-city stops, structure day-by-day activities, and track expenses.
            </p>
            <div className="mt-6">
              <Link href="/trips/new">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
                  <Plus className="h-4 w-4" />
                  Create Your First Trip
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Trips Grid */
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => {
              const stops = (trip.trip_stops || [])
                .sort((a, b) => a.order_index - b.order_index)
                .map((s) => s.custom_city_name)
                .filter(Boolean);

              const stopsLabel = stops.length > 0 ? stops.join(" → ") : "No stops added yet";

              return (
                <Card
                  key={trip.id}
                  className="overflow-hidden border-slate-200 bg-white transition-all hover:border-blue-200 hover:shadow-md"
                >
                  {/* Card Header Banner */}
                  <div className="h-28 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-4 text-white flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-white/20 text-white border-0 text-[10px]">
                        {stops.length > 0 ? `${stops.length} ${stops.length === 1 ? "Stop" : "Stops"}` : "New Plan"}
                      </Badge>
                      <span className="text-[11px] text-blue-100 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateRange(trip.start_date, trip.end_date)}
                      </span>
                    </div>
                    <div>
                      <Link href={`/trips/${trip.id}/view`} className="hover:underline">
                        <h3 className="font-bold text-base line-clamp-1">{trip.title}</h3>
                      </Link>
                      <p className="text-[11px] text-blue-100 line-clamp-1 mt-0.5">{stopsLabel}</p>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    {/* Budget & Details */}
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
                      <span>
                        Budget:{" "}
                        <strong className="text-slate-900 font-semibold">
                          ${trip.total_budget.toLocaleString()} {trip.currency}
                        </strong>
                      </span>
                      {trip.description && (
                        <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[120px]">
                          {trip.description}
                        </span>
                      )}
                    </div>

                    {/* Navigation Actions */}
                    <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                      <Link href={`/trips/${trip.id}/builder`}>
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">
                          Builder
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
      </main>
    </div>
  );
}
