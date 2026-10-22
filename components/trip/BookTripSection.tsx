"use client";

import { useState, useMemo } from "react";
import {
  Hotel,
  Plane,
  Train,
  Car,
  Ticket,
  ExternalLink,
  MapPin,
  Calendar,
  Info,
  Compass,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  generateBookingActions,
  BookingActionItem,
  BookingCategoryKey,
} from "@/lib/booking/bookingLinks";

export interface BookTripStopItem {
  id: string;
  order_index?: number;
  custom_city_name?: string | null;
  name?: string | null;
  cities?: { name?: string | null } | null;
  arrival_date?: string | null;
  departure_date?: string | null;
}

export interface BookTripSectionProps {
  trip: {
    id: string;
    title: string;
    start_date?: string | null;
    end_date?: string | null;
    currency?: string | null;
  };
  stops?: BookTripStopItem[];
}

const CATEGORY_STYLES: Record<
  BookingCategoryKey,
  {
    icon: typeof Hotel;
    iconBg: string;
    iconColor: string;
    cardBorder: string;
    btnClass: string;
    badgeClass: string;
  }
> = {
  hotels: {
    icon: Hotel,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-700",
    cardBorder: "hover:border-cyan-300",
    btnClass: "bg-cyan-600 hover:bg-cyan-700 text-white",
    badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  flights: {
    icon: Plane,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-700",
    cardBorder: "hover:border-sky-300",
    btnClass: "bg-sky-600 hover:bg-sky-700 text-white",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-800",
  },
  trains: {
    icon: Train,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-700",
    cardBorder: "hover:border-emerald-300",
    btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  transport: {
    icon: Car,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-700",
    cardBorder: "hover:border-violet-300",
    btnClass: "bg-violet-600 hover:bg-violet-700 text-white",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-800",
  },
  activities: {
    icon: Ticket,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-700",
    cardBorder: "hover:border-amber-300",
    btnClass: "bg-amber-600 hover:bg-amber-700 text-white",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
};

export function BookTripSection({ trip, stops = [] }: BookTripSectionProps) {
  // Normalize destination cities from stops
  const cityStops = useMemo(() => {
    return [...stops]
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((s, idx) => {
        const cityName =
          s.custom_city_name?.trim() ||
          s.name?.trim() ||
          s.cities?.name?.trim() ||
          `Stop ${idx + 1}`;
        return {
          id: s.id || `stop-${idx}`,
          cityName,
          arrivalDate: s.arrival_date || trip.start_date || null,
          departureDate: s.departure_date || trip.end_date || null,
        };
      })
      .filter((s) => s.cityName.length > 0);
  }, [stops, trip.start_date, trip.end_date]);

  // Selected stop tab (for multi-city trips)
  // 'all' represents the primary/trip-wide destination or first stop
  const [selectedStopId, setSelectedStopId] = useState<string>("all");

  // Determine current active destination, origin, and dates
  const activeParams = useMemo(() => {
    if (selectedStopId !== "all") {
      const targetIndex = cityStops.findIndex((s) => s.id === selectedStopId);
      const targetStop = cityStops[targetIndex];
      if (targetStop) {
        const originCity = targetIndex > 0 ? cityStops[targetIndex - 1].cityName : null;
        return {
          destination: targetStop.cityName,
          origin: originCity,
          startDate: targetStop.arrivalDate,
          endDate: targetStop.departureDate,
          stopName: targetStop.cityName,
        };
      }
    }

    // Default 'all' stops:
    // If multiple cities exist, origin is first city, destination is subsequent city or primary destination
    const primaryDest =
      cityStops.length > 0
        ? cityStops.map((s) => s.cityName).join(", ")
        : trip.title?.trim() || null;

    const originCity = cityStops.length > 1 ? cityStops[0].cityName : null;
    const destCity = cityStops.length > 1 ? cityStops[1].cityName : (cityStops.length === 1 ? cityStops[0].cityName : primaryDest);

    return {
      destination: destCity,
      origin: originCity,
      startDate: trip.start_date || null,
      endDate: trip.end_date || null,
      stopName: cityStops.length > 1 ? `Multi-City (${cityStops.length} Stops)` : null,
    };
  }, [selectedStopId, cityStops, trip.start_date, trip.end_date, trip.title]);

  // Generate the 5 booking action items
  const bookingActions: BookingActionItem[] = useMemo(() => {
    return generateBookingActions({
      destination: activeParams.destination,
      origin: activeParams.origin,
      startDate: activeParams.startDate,
      endDate: activeParams.endDate,
      currency: trip.currency,
    });
  }, [activeParams, trip.currency]);

  const hasDestinations = cityStops.length > 0 || !!trip.title;

  return (
    <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Header */}
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-blue-50/30 py-4 px-5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-bold text-slate-900">
                  Book Your Trip
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold border-blue-200 bg-blue-50 text-blue-700"
                >
                  External Search Links
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Search verified providers for flights, lodging, transit, and experiences.
              </CardDescription>
            </div>
          </div>

          {/* Current Search Target Badge */}
          <div className="flex items-center gap-2 self-start sm:self-center text-xs">
            <Badge
              variant="outline"
              className="text-xs py-1 px-2.5 border-slate-200 bg-white font-medium text-slate-700 flex items-center gap-1.5 shadow-2xs"
            >
              <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
              <span className="truncate max-w-[180px]">
                {activeParams.destination || "Destination Needed"}
              </span>
              {activeParams.startDate && (
                <>
                  <span className="text-slate-300">•</span>
                  <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="text-[11px] text-slate-500">
                    {activeParams.startDate}
                  </span>
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Multi-City Leg Switcher Tabs */}
        {cityStops.length > 1 && (
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">
              Select City Leg:
            </span>
            <button
              type="button"
              onClick={() => setSelectedStopId("all")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedStopId === "all"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              All Stops (Overview)
            </button>
            {cityStops.map((stop, index) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => setSelectedStopId(stop.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                  selectedStopId === stop.id
                    ? "bg-blue-600 text-white font-semibold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                <span className="text-[10px] opacity-75">#{index + 1}</span>
                <span>{stop.cityName}</span>
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Missing Destination Prompt if empty */}
        {!hasDestinations && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Add Destinations for Customized Results</p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Add destination stops and dates to your itinerary in the Builder to automatically populate search queries. You can still use the general links below to explore bookings.
              </p>
            </div>
          </div>
        )}

        {/* 5 Responsive Booking Cards Grid */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {bookingActions.map((action) => {
            const style = CATEGORY_STYLES[action.key];
            const Icon = style.icon;

            return (
              <div
                key={action.key}
                className={`flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all ${style.cardBorder} hover:shadow-xs`}
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Icon & Provider Badge */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${style.iconBg} ${style.iconColor}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-bold py-0.5 px-1.5 ${style.badgeClass}`}
                    >
                      {action.providerName}
                    </Badge>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {action.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                      {action.description}
                    </p>
                  </div>

                  {/* Query / Search Summary Pill */}
                  <div className="rounded-md bg-slate-50 border border-slate-100 p-1.5 text-[10px] text-slate-600 truncate">
                    <span className="text-slate-400 font-medium">Search: </span>
                    <span className="font-semibold text-slate-800">
                      {action.isCustomized ? action.searchQueryText : "General Search Portal"}
                    </span>
                  </div>
                </div>

                {/* External Action Button */}
                <div className="pt-3 mt-3 border-t border-slate-100 space-y-1.5">
                  <a
                    href={action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Search ${action.title} on ${action.providerName} (opens in new tab)`}
                    className="block w-full"
                  >
                    <Button
                      size="sm"
                      className={`w-full text-xs h-8 gap-1.5 font-semibold ${style.btnClass} shadow-2xs`}
                    >
                      <span>Search on {action.providerName}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </Button>
                  </a>
                  {action.officialPortalUrl && action.officialPortalUrl !== action.url && (
                    <div className="text-center pt-0.5">
                      <a
                        href={action.officialPortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-700 hover:text-emerald-800 hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <span>Official IRCTC Booking Portal</span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Third-Party Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-[11px] text-slate-500">
          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-semibold text-slate-700">Third-Party Notice:</span>{" "}
            Clicking these actions will open external provider websites in a new tab. GlobeTrotter does not process payments or sell tickets; all prices, live availability, and reservations are handled directly by each respective provider.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

