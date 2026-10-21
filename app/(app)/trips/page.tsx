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
  Share2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShareTripModal } from "@/components/trip/ShareTripModal";

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
  is_public?: boolean;
  share_slug?: string | null;
  trip_stops?: TripStop[];
}

export default function TripsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sharing & Deletion state
  const [shareModalTrip, setShareModalTrip] = useState<Trip | null>(null);
  const [deleteModalTrip, setDeleteModalTrip] = useState<Trip | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteTrip(tripId: string) {
    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete trip");
      }
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      setSuccessMsg(`"${deleteModalTrip?.title || "Trip"}" deleted successfully.`);
      setDeleteModalTrip(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete trip";
      setErrorMsg(msg);
    } finally {
      setIsDeleting(false);
    }
  }



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

        {/* Success Alert */}
        {successMsg && (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <p>{successMsg}</p>
          </div>
        )}

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
                          {trip.currency} {trip.total_budget.toLocaleString()}
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

                    {/* Sharing & Management Actions */}
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShareModalTrip(trip)}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2 gap-1.5"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        {trip.is_public ? "Manage Share" : "Share Trip"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteModalTrip(trip)}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 px-2 gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Share Trip Modal */}
      {shareModalTrip && (
        <ShareTripModal
          isOpen={true}
          onClose={() => setShareModalTrip(null)}
          tripId={shareModalTrip.id}
          tripTitle={shareModalTrip.title}
          initialIsPublic={shareModalTrip.is_public}
          initialShareSlug={shareModalTrip.share_slug}
          onShareStatusChange={(isPub, slug) => {
            setTrips((prev) =>
              prev.map((t) =>
                t.id === shareModalTrip.id
                  ? { ...t, is_public: isPub, share_slug: slug }
                  : t
              )
            );
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteModalTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Trip</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 font-semibold">&ldquo;{deleteModalTrip.title}&rdquo;</strong>?
              All associated itinerary activities, multi-city stops, expenses, and sharing links will be permanently removed.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalTrip(null)}
                disabled={isDeleting}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleDeleteTrip(deleteModalTrip.id)}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Trip
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
