import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Share2,
  DollarSign,
  AlertCircle,
  Route,
  Receipt,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function TripViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch real trip from Supabase with stops, stop_activities, activities, and expenses
  const { data: trip, error } = await supabase
    .from("trips")
    .select("*, stops(*, stop_activities(*, activities(*))), expenses(*)")
    .eq("id", id)
    .single();

  let tripData: any = trip;

  // Graceful fallback if the database schema uses trip_stops / itinerary_items naming
  if (!tripData) {
    const { data: fallbackData } = await supabase
      .from("trips")
      .select("*, trip_stops(*, itinerary_items(*)), expenses(*)")
      .eq("id", id)
      .single();

    if (fallbackData) {
      tripData = fallbackData;
    }
  }

  // Not found state
  if (!tripData) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Trip Not Found</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            The requested trip could not be found or you may not have permission to view it.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/trips">
              <Button size="sm" variant="outline" className="text-xs">
                Back to Trips
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const rawStops = (tripData.stops || tripData.trip_stops || []) as any[];
  const stops = [...rawStops].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  const expenses = (tripData.expenses || []) as any[];
  const totalExpenses = expenses.reduce(
    (sum, exp) => sum + (Number(exp.amount) || 0),
    0
  );

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
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/trips"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Trips
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-sm text-slate-900 truncate max-w-[200px] sm:max-w-md">
              {tripData.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {tripData.share_slug && (
              <Link href={`/share/${tripData.share_slug}`}>
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-blue-600" />
                  Public Link
                </Button>
              </Link>
            )}
            <Link href={`/trips/${id}/budget`}>
              <Button size="sm" variant="outline" className="text-xs h-8">
                Budget
              </Button>
            </Link>
            <Link href={`/trips/${id}/calendar`}>
              <Button size="sm" variant="outline" className="text-xs h-8">
                Calendar
              </Button>
            </Link>
            <Link href={`/trips/${id}/builder`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
                Trip Builder
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Itinerary Content */}
      <main className="container mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Trip Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs border-blue-200 bg-blue-50 text-blue-700"
                >
                  {stops.length} {stops.length === 1 ? "Stop" : "Stops"}
                </Badge>
                <Badge variant="outline" className="text-xs text-slate-600">
                  <Calendar className="mr-1 h-3 w-3" />
                  {formatDateRange(tripData.start_date, tripData.end_date)}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-800 border border-emerald-200"
                >
                  Active Itinerary
                </Badge>
              </div>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-slate-900">
                {tripData.title}
              </h1>

              {tripData.description && (
                <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
                  {tripData.description}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-right sm:min-w-[180px]">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Total Budget
              </span>
              <span className="text-xl font-black text-slate-900 block mt-0.5">
                ${Number(tripData.total_budget || 0).toLocaleString()}{" "}
                <span className="text-xs font-semibold text-slate-500">
                  {tripData.currency || "USD"}
                </span>
              </span>
              {totalExpenses > 0 && (
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Logged: ${totalExpenses.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Day-by-Day Stops and Activities */}
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Stops & Activities</h2>
            <Link href={`/trips/${id}/builder`}>
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
                Manage in Builder
              </Button>
            </Link>
          </div>

          {stops.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">No stops added yet</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Add cities, destinations, and activities to this trip using the builder.
              </p>
              <div className="mt-5">
                <Link href={`/trips/${id}/builder`}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                    Open Trip Builder
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            stops.map((stop, idx) => {
              const stopName =
                stop.name ||
                stop.custom_city_name ||
                stop.city_name ||
                (stop.cities?.name ? `${stop.cities.name}, ${stop.cities.country}` : `Stop ${idx + 1}`);

              const stopActivities =
                (stop.stop_activities && stop.stop_activities.length > 0)
                  ? stop.stop_activities
                  : (stop.itinerary_items || []);

              return (
                <div
                  key={stop.id || idx}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                        Stop {idx + 1}
                      </span>
                      <h3 className="font-bold text-base text-slate-900">{stopName}</h3>
                    </div>
                    {(stop.arrival_date || stop.departure_date) && (
                      <span className="text-xs text-slate-500">
                        {formatDateRange(stop.arrival_date, stop.departure_date)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {stopActivities.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        No activities scheduled for this stop yet.
                      </p>
                    ) : (
                      stopActivities.map((actItem: any, actIdx: number) => {
                        const act = actItem.activities || actItem.activity || actItem;
                        const title = act.title || actItem.title || `Activity ${actIdx + 1}`;
                        const description = act.description || actItem.description || actItem.notes || null;
                        const cost = act.estimated_cost ?? act.cost ?? actItem.estimated_cost ?? actItem.cost;
                        const category = act.category || actItem.category;

                        return (
                          <div
                            key={actItem.id || actIdx}
                            className="flex items-start gap-3 rounded-lg bg-slate-50/70 p-3 hover:bg-slate-50 transition-colors"
                          >
                            <Clock className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
                                  {category && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {category}
                                    </Badge>
                                  )}
                                </div>
                                {cost !== undefined && cost !== null && (
                                  <span className="text-xs font-bold text-emerald-600">
                                    ${Number(cost).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {description && (
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  {description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Expenses Summary if present */}
        {expenses.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Trip Expenses</h3>
              </div>
              <Link href={`/trips/${id}/budget`}>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                  Full Budget Breakdown
                </Button>
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {expenses.map((expense: any) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs"
                >
                  <div>
                    <span className="font-medium text-slate-900 block">{expense.title}</span>
                    <span className="text-[10px] text-slate-400">{expense.category}</span>
                  </div>
                  <span className="font-bold text-slate-900">
                    ${Number(expense.amount).toLocaleString()} {expense.currency || tripData.currency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
