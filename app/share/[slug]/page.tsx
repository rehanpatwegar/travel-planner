import Link from "next/link";
import {
  Compass,
  Calendar,
  Clock,
  MapPin,
  Share2,
  Copy,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrencyAmount,
  getCategoryBadgeClass,
  formatTimeRange,
  calculateDays,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SharedTripProps {
  params: Promise<{ slug: string }>;
}

export default async function SharedTripPage({ params }: SharedTripProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // 1. Fetch public shared trip metadata
  // Check shared_trips first for active link & expiration
  const { data: sharedRecord } = await supabase
    .from("shared_trips")
    .select("id, trip_id, share_slug, is_active, allow_copy, view_count, expires_at")
    .eq("share_slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  // Check expiration if set
  const isExpired =
    sharedRecord?.expires_at && new Date(sharedRecord.expires_at) < new Date();

  // 2. Query the trip table
  // Can match either via shared_trips.trip_id or directly by trips.share_slug
  let tripQuery = supabase
    .from("trips")
    .select(
      "id, user_id, title, description, start_date, end_date, total_budget, currency, cover_image_url, is_public, share_slug, created_at"
    );

  if (sharedRecord?.trip_id) {
    tripQuery = tripQuery.eq("id", sharedRecord.trip_id);
  } else {
    tripQuery = tripQuery.eq("share_slug", slug);
  }

  const { data: trip, error: tripError } = await tripQuery.maybeSingle();

  // If trip is missing, private, or link is expired/revoked:
  if (tripError || !trip || !trip.is_public || isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Compass className="h-4 w-4" />
              </div>
              <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
            </Link>
            <Link href="/trips/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
                Plan Your Trip
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-5 border border-amber-200">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Shared Itinerary Unavailable
          </h1>
          <p className="mt-2.5 text-xs text-slate-500 leading-relaxed">
            This shared itinerary link is either private, has expired, or was revoked by the trip owner.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs">
                Back to Home
              </Button>
            </Link>
            <Link href="/trips/new">
              <Button size="sm" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
                Create Your Own Trip
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </main>

        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          GlobeTrotter — Smart Multi-City Travel Planning
        </footer>
      </div>
    );
  }

  // Asynchronously increment view count in shared_trips (non-blocking)
  if (sharedRecord?.id) {
    supabase
      .from("shared_trips")
      .update({ view_count: (sharedRecord.view_count || 0) + 1 })
      .eq("id", sharedRecord.id)
      .then(() => {});
  }

  // 3. Fetch stops
  const { data: stops } = await supabase
    .from("trip_stops")
    .select("id, custom_city_name, order_index, arrival_date, departure_date, notes")
    .eq("trip_id", trip.id)
    .order("order_index", { ascending: true });

  // 4. Fetch itinerary items (read-only, public activities)
  const { data: items } = await supabase
    .from("itinerary_items")
    .select(
      "id, trip_stop_id, day_number, date, title, description, category, start_time, end_time, order_index, estimated_cost, currency, notes"
    )
    .eq("trip_id", trip.id)
    .order("day_number", { ascending: true })
    .order("order_index", { ascending: true });

  // 5. Fetch trip creator display name (safe public profile; never expose user email or ID)
  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", trip.user_id)
    .maybeSingle();

  const creatorName = creatorProfile?.full_name?.trim() || "GlobeTrotter Traveler";

  // Calculate duration and days
  const durationDays = calculateDays(trip.start_date, trip.end_date);
  const totalDays = Math.max(
    durationDays,
    ...(items?.map((i) => i.day_number) || [1])
  );

  const stopsList = (stops || [])
    .map((s) => s.custom_city_name)
    .filter(Boolean);
  const routeSummary =
    stopsList.length > 0 ? stopsList.join(" → ") : "Flexible Route";

  // Group items by day
  const itemsByDay: Record<number, typeof items> = {};
  for (let d = 1; d <= totalDays; d++) {
    itemsByDay[d] = [];
  }
  (items || []).forEach((item) => {
    if (!itemsByDay[item.day_number]) {
      itemsByDay[item.day_number] = [];
    }
    itemsByDay[item.day_number]!.push(item);
  });

  function formatDateRange(start: string | null, end: string | null) {
    if (!start && !end) return "Flexible travel dates";
    if (start && !end) return `Departing ${start}`;
    if (!start && end) return `Until ${end}`;
    return `${start} – ${end}`;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Compass className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs gap-1"
            >
              <ShieldCheck className="h-3 w-3" />
              Read-Only Itinerary
            </Badge>
            <Link href="/trips/new">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-xs"
              >
                Plan Your Trip
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 flex-1">
        {/* Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs border-blue-200 bg-blue-50 text-blue-700 font-semibold"
                >
                  {totalDays} {totalDays === 1 ? "Day" : "Days"}
                </Badge>
                <Badge variant="outline" className="text-xs text-slate-600">
                  <Calendar className="mr-1 h-3 w-3 text-slate-400" />
                  {formatDateRange(trip.start_date, trip.end_date)}
                </Badge>
                {trip.total_budget > 0 && (
                  <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-700 font-medium">
                    <DollarSign className="mr-0.5 h-3 w-3 text-slate-400" />
                    Budget: {formatCurrencyAmount(trip.total_budget, trip.currency)}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-slate-900">
                {trip.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-0.5">
                <span className="font-medium text-slate-700">Route: {routeSummary}</span>
                <span>•</span>
                <span>Curated by {creatorName}</span>
              </div>

              {trip.description && (
                <p className="mt-2 text-xs text-slate-600 max-w-2xl leading-relaxed">
                  {trip.description}
                </p>
              )}
            </div>

            <div className="shrink-0">
              <Link href="/trips/new">
                <Button size="sm" variant="outline" className="text-xs gap-1.5 h-9">
                  <Copy className="h-3.5 w-3.5" />
                  Clone Itinerary
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Day-by-Day Itinerary Timeline */}
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Day-by-Day Schedule</h2>
            <span className="text-xs text-slate-400">
              {items?.length || 0} {items?.length === 1 ? "planned activity" : "planned activities"}
            </span>
          </div>

          {Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNum) => {
            const dayItems = itemsByDay[dayNum] || [];
            const dayCost = dayItems.reduce(
              (sum, item) => sum + (Number(item.estimated_cost) || 0),
              0
            );

            // Determine if a stop corresponds to this day
            const stopName =
              stopsList.length > 0
                ? stopsList[Math.min(dayNum - 1, stopsList.length - 1)]
                : null;

            return (
              <div
                key={dayNum}
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">
                      Day {dayNum}
                    </span>
                    {stopName && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                        {stopName}
                      </span>
                    )}
                  </div>
                  {dayCost > 0 && (
                    <span className="text-xs font-medium text-slate-500">
                      Est. {formatCurrencyAmount(dayCost, trip.currency)}
                    </span>
                  )}
                </div>

                {/* Day Activities */}
                <div className="mt-4 space-y-3">
                  {dayItems.length === 0 ? (
                    <div className="rounded-lg bg-slate-50/60 p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200">
                      Free exploration day — no scheduled activities.
                    </div>
                  ) : (
                    dayItems.map((item) => {
                      const timeStr = formatTimeRange(item.start_time, item.end_time);
                      const costFormatted =
                        Number(item.estimated_cost) > 0
                          ? formatCurrencyAmount(
                              item.estimated_cost,
                              item.currency || trip.currency
                            )
                          : "Free";

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-start justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 gap-3 transition-colors hover:bg-slate-50"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-semibold text-slate-900">
                                {item.title}
                              </h4>
                              {item.category && (
                                <span
                                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${getCategoryBadgeClass(
                                    item.category
                                  )}`}
                                >
                                  {item.category}
                                </span>
                              )}
                            </div>

                            {item.description && (
                              <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                                {item.description}
                              </p>
                            )}

                            {item.notes && (
                              <p className="text-[11px] text-slate-500 italic">
                                Note: {item.notes}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0 text-xs">
                            <span className="font-semibold text-slate-800">
                              {costFormatted}
                            </span>
                            {timeStr && (
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="h-3 w-3" />
                                {timeStr}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-center text-white shadow-sm">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 mb-3">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-bold sm:text-2xl">
            Design your own personalized trip
          </h2>
          <p className="mt-2 text-xs text-blue-100 max-w-md mx-auto leading-relaxed">
            Organize multi-city routes, customize day-by-day schedules, calculate budgets, and share itineraries with friends.
          </p>
          <div className="mt-5">
            <Link href="/trips/new">
              <Button size="sm" className="bg-white text-blue-600 hover:bg-slate-100 font-semibold text-xs shadow-xs">
                Start Planning Free
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        GlobeTrotter — Read-only public itinerary share.
      </footer>
    </div>
  );
}
