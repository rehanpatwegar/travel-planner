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
  Sparkles,
  CalendarDays,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCategoryBadgeClass, formatTimeRange, formatCurrencyAmount } from "@/lib/utils";
import { TripAssistantDrawer } from "@/components/ai/TripAssistantDrawer";

export default async function TripViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch trip from Supabase with stops, stop_activities, activities, and expenses
  const { data: trip } = await supabase
    .from("trips")
    .select("*, stops(*, stop_activities(*, activities(*))), expenses(*)")
    .eq("id", id)
    .single();

  let tripData: any = trip;

  // Fallback query if the database schema uses trip_stops / itinerary_items naming
  if (!tripData || (!tripData.stops && !tripData.trip_stops)) {
    const { data: fallbackData } = await supabase
      .from("trips")
      .select("*, trip_stops(*, cities(*)), itinerary_items(*, activities(*)), expenses(*)")
      .eq("id", id)
      .single();

    if (fallbackData) {
      tripData = fallbackData;
    }
  }

  // Ensure itinerary_items are populated
  if (tripData && !tripData.itinerary_items) {
    const { data: itemsData } = await supabase
      .from("itinerary_items")
      .select("*, activities(*)")
      .eq("trip_id", id)
      .order("day_number", { ascending: true })
      .order("order_index", { ascending: true });

    if (itemsData && itemsData.length > 0) {
      tripData.itinerary_items = itemsData;
    }
  }

  // Ensure trip_stops are populated
  if (tripData && !tripData.trip_stops) {
    const { data: stopsData } = await supabase
      .from("trip_stops")
      .select("*, cities(*)")
      .eq("trip_id", id)
      .order("order_index", { ascending: true });

    if (stopsData && stopsData.length > 0) {
      tripData.trip_stops = stopsData;
    }
  }

  // Trip not found state
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

  // Extract destination stops
  const rawStops = (tripData.stops || tripData.trip_stops || []) as any[];
  const stops = [...rawStops].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  const destinationCities = stops
    .map((s) => s.custom_city_name || s.name || s.cities?.name)
    .filter(Boolean);

  // Extract all scheduled activities
  const allItems: any[] = [];
  if (tripData.itinerary_items && Array.isArray(tripData.itinerary_items)) {
    allItems.push(...tripData.itinerary_items);
  }

  // Also collect stop activities if present
  stops.forEach((stop) => {
    const subActivities = stop.stop_activities || [];
    subActivities.forEach((sub: any) => {
      const alreadyIncluded = allItems.some((i) => i.id === sub.id);
      if (!alreadyIncluded) {
        allItems.push({
          ...sub,
          trip_stop_id: sub.trip_stop_id || stop.id,
          custom_city_name: stop.custom_city_name || stop.cities?.name || stop.name,
        });
      }
    });
  });

  // Calculate duration and days
  let durationText = "Flexible Dates";
  let totalDays = 1;

  if (tripData.start_date && tripData.end_date) {
    const start = new Date(tripData.start_date);
    const end = new Date(tripData.end_date);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diff > 0) {
      totalDays = diff;
      durationText = `${diff} ${diff === 1 ? "Day" : "Days"}`;
    }
  } else if (tripData.start_date) {
    durationText = `Starting ${tripData.start_date}`;
  }

  const maxItemDay = allItems.reduce(
    (max, item) => Math.max(max, Number(item.day_number) || 1),
    1
  );
  totalDays = Math.max(totalDays, maxItemDay);

  // Group items by day
  const itemsByDay: Record<number, any[]> = {};
  for (let d = 1; d <= totalDays; d++) {
    itemsByDay[d] = [];
  }

  allItems.forEach((item) => {
    const day = Number(item.day_number) || 1;
    if (!itemsByDay[day]) itemsByDay[day] = [];
    itemsByDay[day].push(item);
  });

  Object.keys(itemsByDay).forEach((k) => {
    const d = Number(k);
    itemsByDay[d].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  });

  // Expenses calculation
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

  function getDayDate(startDate: string | null, dayIndex: number): string | null {
    if (!startDate) return null;
    const s = new Date(startDate);
    s.setDate(s.getDate() + (dayIndex - 1));
    return s.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/trips"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
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
            <Link href="/dashboard">
              <Button size="sm" variant="ghost" className="text-xs h-8 gap-1.5 text-slate-600">
                <LayoutDashboard className="h-3.5 w-3.5 text-slate-400" />
                Dashboard
              </Button>
            </Link>
            <Link href={`/trips/${id}/calendar`}>
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-indigo-600" />
                Calendar
              </Button>
            </Link>
            <Link href={`/trips/${id}/builder`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-xs">
                <Layers className="h-3.5 w-3.5" />
                Itinerary Builder
              </Button>
            </Link>
            {tripData.share_slug && (
              <Link href={`/share/${tripData.share_slug}`}>
                <Button size="sm" variant="outline" className="text-xs h-8 gap-1 text-slate-600">
                  <Share2 className="h-3.5 w-3.5 text-blue-600" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Itinerary Content */}
      <main className="container mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Trip Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs border-blue-200 bg-blue-50 text-blue-700 font-semibold"
                >
                  {durationText}
                </Badge>
                <Badge variant="outline" className="text-xs text-slate-600">
                  <Calendar className="mr-1 h-3 w-3 text-slate-400" />
                  {formatDateRange(tripData.start_date, tripData.end_date)}
                </Badge>
                {stops.length > 0 && (
                  <Badge variant="outline" className="text-xs text-slate-600">
                    <Route className="mr-1 h-3 w-3 text-slate-400" />
                    {stops.length} {stops.length === 1 ? "Stop" : "Stops"}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs"
                >
                  Active Itinerary
                </Badge>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl text-slate-900">
                {tripData.title}
              </h1>

              {destinationCities.length > 0 && (
                <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {destinationCities.join(" → ")}
                </p>
              )}

              {tripData.description && (
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed mt-1">
                  {tripData.description}
                </p>
              )}
            </div>

            {/* Budget & Cost Summary */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-right sm:min-w-[190px]">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Total Budget
              </span>
              <span className="text-xl font-black text-slate-900 block mt-0.5">
                {formatCurrencyAmount(Number(tripData.total_budget || 0), tripData.currency)}{" "}
                <span className="text-xs font-semibold text-slate-500">
                  {tripData.currency || "USD"}
                </span>
              </span>
              {totalExpenses > 0 && (
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Logged: {formatCurrencyAmount(totalExpenses, tripData.currency)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Day-by-Day Timeline */}
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Day-by-Day Schedule</h2>
            <div className="flex items-center gap-2">
              <Link href={`/trips/${id}/calendar`}>
                <Button variant="ghost" size="sm" className="text-xs text-indigo-600 hover:text-indigo-700">
                  View in Calendar →
                </Button>
              </Link>
              <Link href={`/trips/${id}/builder`}>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
                  Edit in Builder
                </Button>
              </Link>
            </div>
          </div>

          {allItems.length === 0 ? (
            /* Empty state */
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Layers className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">No activities scheduled yet</h3>
              <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Build your itinerary day by day. Schedule sightseeing, dining, attractions, and activities with ease.
              </p>
              <div className="mt-6 flex justify-center gap-2.5">
                <Link href={`/trips/${id}/builder`}>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
                    Open Itinerary Builder
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* Day-by-Day Columns */
            Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNum) => {
              const dayItems = itemsByDay[dayNum] || [];
              const dayDate = getDayDate(tripData.start_date, dayNum);
              const assignedStop = stops[dayNum - 1] || null;
              const stopTitle =
                assignedStop?.custom_city_name ||
                assignedStop?.name ||
                assignedStop?.cities?.name ||
                null;

              const dayCurrencyMap: Record<string, number> = {};
              dayItems.forEach((item: any) => {
                const cost = Number(item.estimated_cost ?? item.activities?.estimated_cost ?? 0);
                if (cost > 0) {
                  const cur = (item.currency || tripData.currency || "USD").toUpperCase();
                  dayCurrencyMap[cur] = (dayCurrencyMap[cur] || 0) + cost;
                }
              });
              const dayCostEntries = Object.entries(dayCurrencyMap);
              const dayCostSummary = dayCostEntries.length > 0
                ? dayCostEntries.map(([cur, amt]) => formatCurrencyAmount(amt, cur)).join(" + ")
                : null;

              return (
                <div
                  key={dayNum}
                  className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden"
                >
                  {/* Day Header */}
                  <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white shadow-2xs">
                        Day {dayNum}
                      </span>

                      {dayDate && (
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {dayDate}
                        </span>
                      )}

                      {stopTitle && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-blue-200 bg-white text-blue-700 flex items-center gap-1 font-medium"
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          {stopTitle}
                        </Badge>
                      )}

                      <span className="text-[11px] text-slate-400">
                        • {dayItems.length} {dayItems.length === 1 ? "activity" : "activities"}
                      </span>
                    </div>

                    {dayCostSummary && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {dayCostSummary} est.
                      </span>
                    )}
                  </div>

                  {/* Day Activities List */}
                  <div className="p-4 sm:p-5 space-y-3">
                    {dayItems.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        No activities scheduled for Day {dayNum}.
                      </p>
                    ) : (
                      dayItems.map((item: any, actIdx: number) => {
                        const act = item.activities || item.activity || item;
                        const title = act.title || item.title || `Activity ${actIdx + 1}`;
                        const description =
                          item.description || item.notes || act.description || null;
                        const cost =
                          item.estimated_cost ?? act.estimated_cost ?? item.cost ?? null;
                        const category = item.category || act.category || "Sightseeing";
                        const timeText = formatTimeRange(item.start_time, item.end_time);
                        const durationMins =
                          act.duration_minutes ?? item.duration_minutes ?? null;
                        const location =
                          item.custom_city_name ||
                          act.city_name ||
                          act.address ||
                          stopTitle ||
                          null;

                        return (
                          <div
                            key={item.id || actIdx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-blue-200 transition-colors"
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mt-0.5">
                                <Clock className="h-4 w-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 font-medium ${getCategoryBadgeClass(
                                      category
                                    )}`}
                                  >
                                    {category}
                                  </Badge>

                                  {timeText && (
                                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                      <Clock className="h-3 w-3 text-slate-400" />
                                      {timeText}
                                    </span>
                                  )}

                                  {location && (
                                    <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                      <MapPin className="h-3 w-3 text-slate-400" />
                                      {location}
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-bold text-sm text-slate-900 mt-1">
                                  {title}
                                </h4>

                                {description && (
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                    {description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                              {cost !== null && cost !== undefined && (
                                <span className="text-xs font-bold text-emerald-600">
                                  {Number(cost) === 0
                                    ? "Free"
                                    : `${formatCurrencyAmount(Number(cost), item.currency || tripData.currency)} est.`}
                                </span>
                              )}
                              {durationMins && Number(durationMins) > 0 && (
                                <span className="text-[11px] text-slate-400 mt-0.5">
                                  {Number(durationMins) >= 60
                                    ? `${Math.floor(Number(durationMins) / 60)}h ${
                                        Number(durationMins) % 60 ? `${Number(durationMins) % 60}m` : ""
                                      }`
                                    : `${durationMins}m`}
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
            })
          )}
        </div>

        {/* Expenses Section if present */}
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
                    {expense.currency || tripData.currency || "USD"} {Number(expense.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {tripData && (
        <TripAssistantDrawer
          tripId={tripData.id}
          tripTitle={tripData.title}
        />
      )}
    </div>
  );
}
