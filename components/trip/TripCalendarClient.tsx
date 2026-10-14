"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  DollarSign,
  MapPin,
  X,
  Layers,
  ChevronRight,
  ExternalLink,
  Calendar as CalendarIcon,
  HelpCircle,
  AlertCircle,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trip, TripStop, ItineraryItem } from "./types";
import { getCategoryBadgeClass, formatTimeRange } from "./SortableItineraryItem";

interface TripCalendarClientProps {
  trip: Trip;
  items: ItineraryItem[];
  stops: TripStop[];
}

interface SelectedEventDetails {
  id: string;
  title: string;
  dateStr: string;
  timeStr: string | null;
  category: string;
  cost: number;
  notes: string | null;
  city: string | null;
  dayNumber: number;
}

function getEventColor(category: string): string {
  switch (category) {
    case "Culture & History":
      return "#7c3aed"; // violet-600
    case "Food & Dining":
      return "#d97706"; // amber-600
    case "Sightseeing":
      return "#2563eb"; // blue-600
    case "Adventure":
      return "#059669"; // emerald-600
    case "Relaxation":
      return "#0891b2"; // cyan-600
    case "Shopping":
      return "#e11d48"; // rose-600
    case "Nature":
      return "#16a34a"; // green-600
    case "Entertainment":
      return "#9333ea"; // purple-600
    default:
      return "#3b82f6"; // blue-500
  }
}

export function TripCalendarClient({
  trip,
  items,
  stops,
}: TripCalendarClientProps) {
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventDetails | null>(
    null
  );
  const [currentView, setCurrentView] = useState<"dayGridMonth" | "timeGridWeek">(
    "dayGridMonth"
  );

  // Partition items into scheduled (with calendar date) and unscheduled
  const { scheduledEvents, unscheduledItems } = useMemo(() => {
    const scheduled: any[] = [];
    const unscheduled: ItineraryItem[] = [];

    items.forEach((item) => {
      let dateStr: string | null = null;

      // 1. Check explicit item.date
      if (item.date) {
        dateStr = item.date;
      } else if (trip.start_date && (item.day_number || 1) >= 1) {
        // 2. Derive date from trip.start_date + (day_number - 1)
        const d = new Date(trip.start_date);
        d.setDate(d.getDate() + (Number(item.day_number || 1) - 1));
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().split("T")[0];
        }
      }

      if (!dateStr) {
        // No confirmed calendar date available
        unscheduled.push(item);
        return;
      }

      const hasSpecificTime = Boolean(item.start_time);
      const startTimeFormatted = item.start_time
        ? item.start_time.slice(0, 5)
        : null;
      const endTimeFormatted = item.end_time
        ? item.end_time.slice(0, 5)
        : null;

      const eventStart = hasSpecificTime
        ? `${dateStr}T${startTimeFormatted}:00`
        : dateStr;

      const eventEnd = hasSpecificTime && endTimeFormatted
        ? `${dateStr}T${endTimeFormatted}:00`
        : undefined;

      const color = getEventColor(item.category);

      // Associate city if present
      const stop = stops.find((s) => s.id === item.trip_stop_id);
      const cityName =
        stop?.custom_city_name ||
        stop?.cities?.name ||
        item.activities?.city_name ||
        null;

      scheduled.push({
        id: item.id,
        title: item.title,
        start: eventStart,
        end: eventEnd,
        allDay: !hasSpecificTime,
        backgroundColor: color,
        borderColor: color,
        textColor: "#ffffff",
        extendedProps: {
          category: item.category,
          cost: Number(item.estimated_cost) || 0,
          notes: item.notes || item.description || null,
          dayNumber: item.day_number || 1,
          city: cityName,
          dateStr,
          timeStr: formatTimeRange(item.start_time, item.end_time),
        },
      });
    });

    return { scheduledEvents: scheduled, unscheduledItems: unscheduled };
  }, [items, trip.start_date, stops]);

  function handleEventClick(clickInfo: any) {
    const { event } = clickInfo;
    const props = event.extendedProps;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      dateStr: props.dateStr || event.startStr.split("T")[0],
      timeStr: props.timeStr,
      category: props.category || "Sightseeing",
      cost: props.cost || 0,
      notes: props.notes,
      city: props.city,
      dayNumber: props.dayNumber || 1,
    });
  }

  const initialCalendarDate = useMemo(() => {
    if (trip.start_date) {
      const d = new Date(trip.start_date);
      if (!isNaN(d.getTime())) {
        return trip.start_date;
      }
    }
    return undefined;
  }, [trip.start_date]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/trips/${trip.id}/view`}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Itinerary View
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-sm text-slate-900 truncate max-w-[200px] sm:max-w-md">
              {trip.title}
            </span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[10px] border-indigo-200 bg-indigo-50 text-indigo-700"
            >
              Calendar
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button size="sm" variant="ghost" className="text-xs h-8 gap-1.5 text-slate-600">
                <LayoutDashboard className="h-3.5 w-3.5 text-slate-400" />
                Dashboard
              </Button>
            </Link>
            <Link href={`/trips/${trip.id}/view`}>
              <Button size="sm" variant="outline" className="text-xs h-8">
                Itinerary View
              </Button>
            </Link>
            <Link href={`/trips/${trip.id}/builder`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-xs">
                <Layers className="h-3.5 w-3.5" />
                Trip Builder
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Banner */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className="text-xs border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold"
                >
                  <CalendarDays className="mr-1 h-3 w-3" />
                  Calendar Timeline
                </Badge>
                {trip.start_date && (
                  <Badge variant="outline" className="text-xs text-slate-600">
                    {trip.start_date} {trip.end_date ? `to ${trip.end_date}` : ""}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                  {scheduledEvents.length} Scheduled Events
                </Badge>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {trip.title} Calendar
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Inspect your day-by-day travel schedule, activity timings, and appointments on the calendar grid.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/trips/${trip.id}/builder`}>
                <Button size="sm" variant="outline" className="text-xs h-8.5 gap-1.5">
                  Manage in Builder
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Layout: Calendar Grid + Unscheduled Items Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Calendar View (3 cols on desktop) */}
          <div className="lg:col-span-3">
            <Card className="border-slate-200 bg-white p-4 sm:p-6 shadow-xs overflow-hidden">
              {scheduledEvents.length === 0 && unscheduledItems.length === 0 ? (
                /* Completely Empty State */
                <div className="py-20 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3">
                    <CalendarDays className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">No events on this calendar yet</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    Add activities with dates and scheduled times in the itinerary builder to see them populated here.
                  </p>
                  <div className="mt-5">
                    <Link href={`/trips/${trip.id}/builder`}>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
                        Open Itinerary Builder
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="calendar-container">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin] as any}
                    initialView={currentView}
                    initialDate={initialCalendarDate}
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek",
                    }}
                    events={scheduledEvents}
                    eventClick={handleEventClick}
                    height="auto"
                    aspectRatio={1.5}
                    dayMaxEvents={3}
                    eventTimeFormat={{
                      hour: "numeric",
                      minute: "2-digit",
                      meridiem: "short",
                    }}
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar: Unscheduled Activities & Summary (1 col on desktop) */}
          <div className="space-y-6">
            {/* Unscheduled Activities Card */}
            <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <CardTitle className="text-xs font-bold text-slate-900">
                    Unscheduled Items
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] bg-white">
                  {unscheduledItems.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5">
                {unscheduledItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 text-center">
                    All planned activities have scheduled dates.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                      These activities have not been assigned specific calendar dates or the trip start date is flexible.
                    </p>
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {unscheduledItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs hover:border-blue-200 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-semibold text-slate-900 truncate">
                              {item.title}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-bold shrink-0">
                              {Number(item.estimated_cost) > 0
                                ? `$${Number(item.estimated_cost).toFixed(0)}`
                                : "Free"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 ${getCategoryBadgeClass(
                                item.category
                              )}`}
                            >
                              {item.category}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              Day {item.day_number || 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <Link href={`/trips/${trip.id}/builder`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8 text-blue-600 hover:text-blue-700"
                        >
                          Assign Dates in Builder →
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Calendar Legend Card */}
            <Card className="border-slate-200 bg-white shadow-xs p-4">
              <h4 className="text-xs font-bold text-slate-900 mb-2.5">
                Category Legend
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  <span>Sightseeing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                  <span>Culture & History</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                  <span>Food & Dining</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                  <span>Adventure</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-600" />
                  <span>Relaxation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                  <span>Shopping</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Day {selectedEvent.dayNumber} Event
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium ${getCategoryBadgeClass(
                    selectedEvent.category
                  )}`}
                >
                  {selectedEvent.category}
                </Badge>
                {selectedEvent.cost > 0 ? (
                  <span className="font-bold text-emerald-600">
                    ${selectedEvent.cost.toFixed(0)} est.
                  </span>
                ) : (
                  <span className="font-medium text-slate-400">Free</span>
                )}
              </div>

              {/* Date and Time */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span>{selectedEvent.dateStr}</span>
                </div>
                {selectedEvent.timeStr ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedEvent.timeStr}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 italic">
                    <Clock className="h-3.5 w-3.5" />
                    <span>All day / flexible time</span>
                  </div>
                )}
                {selectedEvent.city && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedEvent.city}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedEvent.notes && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">
                    Notes & Details:
                  </span>
                  <p className="text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                    {selectedEvent.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEvent(null)}
                className="text-xs"
              >
                Close
              </Button>
              <Link href={`/trips/${trip.id}/builder`}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
                  Edit in Builder
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

