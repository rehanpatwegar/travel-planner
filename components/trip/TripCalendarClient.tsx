"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  ),
});
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
  Loader2,
  CheckCircle2,
  Edit3,
  CalendarPlus,
  RefreshCw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trip, TripStop, ItineraryItem } from "./types";
import { getCategoryBadgeClass, formatTimeRange, formatCurrencyAmount } from "@/lib/utils";

interface TripCalendarClientProps {
  trip: Trip;
  items: ItineraryItem[];
  stops: TripStop[];
}

interface SelectedEventDetails {
  id: string;
  title: string;
  dateStr: string;
  startTime: string;
  endTime: string;
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
  items: initialItems,
  stops,
}: TripCalendarClientProps) {
  // Local state for synchronized items
  const [items, setItems] = useState<ItineraryItem[]>(initialItems);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Selected event details modal
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventDetails | null>(null);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Modal to schedule an unscheduled item
  const [schedulingItem, setSchedulingItem] = useState<ItineraryItem | null>(null);
  const [quickScheduleDate, setQuickScheduleDate] = useState("");
  const [quickScheduleStartTime, setQuickScheduleStartTime] = useState("");
  const [quickScheduleEndTime, setQuickScheduleEndTime] = useState("");

  // Partition items into scheduled (with confirmed calendar date) and unscheduled
  const { scheduledEvents, unscheduledItems } = useMemo(() => {
    const scheduled: any[] = [];
    const unscheduled: ItineraryItem[] = [];

    items.forEach((item) => {
      let dateStr: string | null = null;

      // 1. Explicit item.date takes priority
      if (item.date) {
        dateStr = item.date;
      } else if (trip.start_date && (item.day_number || 1) >= 1) {
        // 2. Compute date from trip.start_date + (day_number - 1)
        const d = new Date(trip.start_date);
        d.setDate(d.getDate() + (Number(item.day_number || 1) - 1));
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().split("T")[0];
        }
      }

      if (!dateStr) {
        unscheduled.push(item);
        return;
      }

      const hasSpecificTime = Boolean(item.start_time);
      const startTimeFormatted = item.start_time ? item.start_time.slice(0, 5) : null;
      const endTimeFormatted = item.end_time ? item.end_time.slice(0, 5) : null;

      const eventStart = hasSpecificTime
        ? `${dateStr}T${startTimeFormatted}:00`
        : dateStr;

      const eventEnd = hasSpecificTime && endTimeFormatted
        ? `${dateStr}T${endTimeFormatted}:00`
        : undefined;

      const color = getEventColor(item.category);

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
          startTime: startTimeFormatted || "",
          endTime: endTimeFormatted || "",
          timeStr: formatTimeRange(item.start_time, item.end_time),
        },
      });
    });

    return { scheduledEvents: scheduled, unscheduledItems: unscheduled };
  }, [items, trip.start_date, stops]);

  // Click handler for events on the calendar
  function handleEventClick(clickInfo: any) {
    const { event } = clickInfo;
    const props = event.extendedProps;
    const dateStr = props.dateStr || event.startStr.split("T")[0];

    setSelectedEvent({
      id: event.id,
      title: event.title,
      dateStr,
      startTime: props.startTime || "",
      endTime: props.endTime || "",
      category: props.category || "Sightseeing",
      cost: props.cost || 0,
      notes: props.notes,
      city: props.city,
      dayNumber: props.dayNumber || 1,
    });

    // Populate initial edit values
    setEditDate(dateStr);
    setEditStartTime(props.startTime || "");
    setEditEndTime(props.endTime || "");
    setIsEditingSchedule(false);
  }

  // Drag and drop event onto a new date or time
  async function handleEventDrop(dropInfo: any) {
    const { event, revert } = dropInfo;
    const itemId = event.id;
    const newDateStr = event.startStr.split("T")[0];

    let newStartTime: string | null = null;
    let newEndTime: string | null = null;

    if (event.startStr.includes("T")) {
      newStartTime = event.startStr.split("T")[1].slice(0, 5);
    }
    if (event.endStr && event.endStr.includes("T")) {
      newEndTime = event.endStr.split("T")[1].slice(0, 5);
    }

    // Recalculate day_number relative to trip.start_date
    let newDayNumber: number | undefined;
    if (trip.start_date) {
      const startD = new Date(trip.start_date);
      const droppedD = new Date(newDateStr);
      const diff =
        Math.round((droppedD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff >= 1) {
        newDayNumber = diff;
      }
    }

    setSaveStatus("saving");
    setErrorNotice(null);

    // Optimistic local update
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            date: newDateStr,
            ...(newDayNumber ? { day_number: newDayNumber } : {}),
            ...(newStartTime ? { start_time: newStartTime } : {}),
            ...(newEndTime ? { end_time: newEndTime } : {}),
          };
        }
        return it;
      })
    );

    try {
      const res = await fetch(`/api/trips/${trip.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newDateStr,
          ...(newDayNumber ? { day_number: newDayNumber } : {}),
          ...(newStartTime !== null ? { start_time: newStartTime } : {}),
          ...(newEndTime !== null ? { end_time: newEndTime } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to persist event date change");
      }

      const { item: updated } = await res.json();
      setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)));
      setSaveStatus("saved");
    } catch (err: unknown) {
      console.error("Event drop error:", err);
      revert();
      setSaveStatus("error");
      setErrorNotice(
        err instanceof Error ? err.message : "Failed to reschedule event on server"
      );
    }
  }

  // Resize event to change start/end duration
  async function handleEventResize(resizeInfo: any) {
    const { event, revert } = resizeInfo;
    const itemId = event.id;

    let newStartTime: string | null = null;
    let newEndTime: string | null = null;

    if (event.startStr.includes("T")) {
      newStartTime = event.startStr.split("T")[1].slice(0, 5);
    }
    if (event.endStr && event.endStr.includes("T")) {
      newEndTime = event.endStr.split("T")[1].slice(0, 5);
    }

    setSaveStatus("saving");
    setErrorNotice(null);

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            ...(newStartTime ? { start_time: newStartTime } : {}),
            ...(newEndTime ? { end_time: newEndTime } : {}),
          };
        }
        return it;
      })
    );

    try {
      const res = await fetch(`/api/trips/${trip.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(newStartTime ? { start_time: newStartTime } : {}),
          ...(newEndTime ? { end_time: newEndTime } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update event duration");
      }

      const { item: updated } = await res.json();
      setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)));
      setSaveStatus("saved");
    } catch (err: unknown) {
      console.error("Event resize error:", err);
      revert();
      setSaveStatus("error");
      setErrorNotice(
        err instanceof Error ? err.message : "Failed to update event duration on server"
      );
    }
  }

  // Save manual reschedule from modal
  async function handleSaveReschedule() {
    if (!selectedEvent || !editDate) return;

    setIsSubmittingModal(true);
    setErrorNotice(null);
    setSaveStatus("saving");

    let newDayNumber: number | undefined;
    if (trip.start_date) {
      const startD = new Date(trip.start_date);
      const chosenD = new Date(editDate);
      const diff =
        Math.round((chosenD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff >= 1) {
        newDayNumber = diff;
      }
    }

    try {
      const res = await fetch(`/api/trips/${trip.id}/items/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editDate,
          start_time: editStartTime || null,
          end_time: editEndTime || null,
          ...(newDayNumber ? { day_number: newDayNumber } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update item schedule");
      }

      const { item: updated } = await res.json();
      setItems((prev) => prev.map((it) => (it.id === selectedEvent.id ? updated : it)));
      setSaveStatus("saved");
      setSelectedEvent(null);
    } catch (err: unknown) {
      console.error("Save schedule error:", err);
      setSaveStatus("error");
      setErrorNotice(
        err instanceof Error ? err.message : "Error saving schedule changes"
      );
    } finally {
      setIsSubmittingModal(false);
    }
  }

  // Unschedule an item (make date and time flexible)
  async function handleUnscheduleItem() {
    if (!selectedEvent) return;

    setIsSubmittingModal(true);
    setSaveStatus("saving");
    setErrorNotice(null);

    try {
      const res = await fetch(`/api/trips/${trip.id}/items/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: null,
          start_time: null,
          end_time: null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to unschedule item");
      }

      const { item: updated } = await res.json();
      setItems((prev) => prev.map((it) => (it.id === selectedEvent.id ? updated : it)));
      setSaveStatus("saved");
      setSelectedEvent(null);
    } catch (err: unknown) {
      console.error("Unschedule error:", err);
      setSaveStatus("error");
      setErrorNotice(
        err instanceof Error ? err.message : "Error unscheduling item"
      );
    } finally {
      setIsSubmittingModal(false);
    }
  }

  // Quick schedule an unscheduled item from the sidebar
  async function handleQuickSchedule() {
    if (!schedulingItem || !quickScheduleDate) return;

    setIsSubmittingModal(true);
    setSaveStatus("saving");
    setErrorNotice(null);

    let newDayNumber: number | undefined;
    if (trip.start_date) {
      const startD = new Date(trip.start_date);
      const chosenD = new Date(quickScheduleDate);
      const diff =
        Math.round((chosenD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff >= 1) {
        newDayNumber = diff;
      }
    }

    try {
      const res = await fetch(`/api/trips/${trip.id}/items/${schedulingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: quickScheduleDate,
          start_time: quickScheduleStartTime || null,
          end_time: quickScheduleEndTime || null,
          ...(newDayNumber ? { day_number: newDayNumber } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to assign schedule");
      }

      const { item: updated } = await res.json();
      setItems((prev) => prev.map((it) => (it.id === schedulingItem.id ? updated : it)));
      setSaveStatus("saved");
      setSchedulingItem(null);
    } catch (err: unknown) {
      console.error("Quick schedule error:", err);
      setSaveStatus("error");
      setErrorNotice(
        err instanceof Error ? err.message : "Error assigning date to item"
      );
    } finally {
      setIsSubmittingModal(false);
    }
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
            <span className="font-bold text-sm text-slate-900 truncate max-w-[160px] sm:max-w-md">
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
            {/* Save Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-slate-50 border-slate-200">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  <span className="text-slate-600 text-[11px]">Saving changes...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span className="text-slate-600 text-[11px]">All changes saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertCircle className="h-3 w-3 text-rose-600" />
                  <span className="text-rose-700 text-[11px]">Save error</span>
                </>
              )}
            </div>

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
        {/* Error Notification */}
        {errorNotice && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorNotice}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setErrorNotice(null)}
              className="text-xs h-7 border-rose-300 bg-white"
            >
              Dismiss
            </Button>
          </div>
        )}

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
                  Interactive Calendar
                </Badge>
                {trip.start_date && (
                  <Badge variant="outline" className="text-xs text-slate-600">
                    {trip.start_date} {trip.end_date ? `to ${trip.end_date}` : ""}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                  {scheduledEvents.length} Scheduled
                </Badge>
                {unscheduledItems.length > 0 && (
                  <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-800">
                    {unscheduledItems.length} Flexible
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {trip.title} Calendar
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Inspect your schedule, switch between Month and Week views, and drag events to reschedule them.
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

        {/* Layout: Calendar Grid + Sidebar */}
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
                  <h3 className="text-base font-bold text-slate-900">No activities on this calendar yet</h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    Add activities with scheduled dates and times in the itinerary builder to see them populated here.
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
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    initialDate={initialCalendarDate}
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    editable={true}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
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

          {/* Sidebar: Unscheduled Activities & Legend */}
          <div className="space-y-6">
            {/* Unscheduled Activities Card */}
            <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
              <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <CardTitle className="text-xs font-bold text-slate-900">
                    Unscheduled & Flexible
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] bg-white">
                  {unscheduledItems.length}
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-2.5">
                {unscheduledItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 text-center">
                    All planned activities have scheduled dates on the calendar.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                      These activities have not been locked to calendar dates yet. Click <strong>Schedule</strong> to place them on the calendar.
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
                                ? formatCurrencyAmount(Number(item.estimated_cost), item.currency || trip.currency)
                                : "Free"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-100">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 ${getCategoryBadgeClass(
                                item.category
                              )}`}
                            >
                              {item.category}
                            </Badge>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSchedulingItem(item);
                                setQuickScheduleDate(trip.start_date || new Date().toISOString().split("T")[0]);
                                setQuickScheduleStartTime(item.start_time ? item.start_time.slice(0, 5) : "10:00");
                                setQuickScheduleEndTime(item.end_time ? item.end_time.slice(0, 5) : "12:00");
                              }}
                              className="text-[11px] h-6 px-2 text-blue-600 hover:text-blue-700 bg-white"
                            >
                              <CalendarPlus className="mr-1 h-3 w-3" />
                              Schedule
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <Link href={`/trips/${trip.id}/builder`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs h-7 text-blue-600 hover:text-blue-700"
                        >
                          Manage in Builder →
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
                Category Color Legend
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

      {/* Event Details & Reschedule Modal */}
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
            <div className="p-6 space-y-4 text-xs text-slate-600 overflow-y-auto">
              <div className="flex items-center justify-between">
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
                      {formatCurrencyAmount(selectedEvent.cost, trip.currency)} est.
                    </span>
                  ) : (
                    <span className="font-medium text-slate-400">Free</span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingSchedule(!isEditingSchedule)}
                  className="text-xs h-7 text-blue-600 hover:text-blue-700"
                >
                  <Edit3 className="mr-1 h-3 w-3" />
                  {isEditingSchedule ? "View Info" : "Reschedule"}
                </Button>
              </div>

              {/* View Mode or Edit/Reschedule Mode */}
              {isEditingSchedule ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
                    Reschedule Activity
                  </h4>

                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 block mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 block mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUnscheduleItem}
                      disabled={isSubmittingModal}
                      className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 h-8"
                    >
                      Unschedule Item
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveReschedule}
                      disabled={isSubmittingModal || !editDate}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                    >
                      {isSubmittingModal ? "Saving..." : "Save Schedule"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedEvent.dateStr}</span>
                  </div>
                  {selectedEvent.startTime ? (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {selectedEvent.startTime}
                        {selectedEvent.endTime ? ` - ${selectedEvent.endTime}` : ""}
                      </span>
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
              )}

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

      {/* Quick Schedule Modal for Unscheduled Item */}
      {schedulingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Schedule Activity
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {schedulingItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSchedulingItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-slate-600">
              <p className="text-slate-500 text-xs">
                Pick a date and scheduled time to add this activity to your trip calendar timeline.
              </p>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">
                  Calendar Date *
                </label>
                <input
                  type="date"
                  value={quickScheduleDate}
                  min={trip.start_date || undefined}
                  max={trip.end_date || undefined}
                  onChange={(e) => setQuickScheduleDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={quickScheduleStartTime}
                    onChange={(e) => setQuickScheduleStartTime(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={quickScheduleEndTime}
                    onChange={(e) => setQuickScheduleEndTime(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSchedulingItem(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleQuickSchedule}
                disabled={isSubmittingModal || !quickScheduleDate}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8.5 gap-1.5"
              >
                {isSubmittingModal ? "Scheduling..." : "Add to Calendar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
