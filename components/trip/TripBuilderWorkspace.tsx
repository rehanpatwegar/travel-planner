"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Plus,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  Share2,
  GripVertical,
  Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Trip, TripStop, ItineraryItem, Expense } from "./types";
import { DroppableDayColumn } from "./DroppableDayColumn";
import { ActivitySearchModal } from "./ActivitySearchModal";
import { AddStopModal } from "./AddStopModal";
import { EditItemModal } from "./EditItemModal";
import { AISmartSuggestModal } from "./AISmartSuggestModal";
import { ItineraryOptimizerModal } from "@/components/ai/ItineraryOptimizerModal";
import { TripAssistantDrawer } from "@/components/ai/TripAssistantDrawer";
import { TripHealthBadge } from "./TripHealthBadge";
import { TripHealthModal } from "./TripHealthModal";
import { computeTripHealth } from "@/lib/scoring/tripHealth";
import { getCategoryBadgeClass, formatTimeRange } from "./SortableItineraryItem";
import { formatCurrencyAmount } from "@/lib/utils";
import { ShareTripModal } from "./ShareTripModal";

interface TripBuilderWorkspaceProps {
  initialTrip: Trip;
  initialStops: TripStop[];
  initialItems: ItineraryItem[];
  initialExpenses?: Expense[];
}

export function TripBuilderWorkspace({
  initialTrip,
  initialStops,
  initialItems,
  initialExpenses = [],
}: TripBuilderWorkspaceProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [stops, setStops] = useState<TripStop[]>(initialStops);
  const [items, setItems] = useState<ItineraryItem[]>(initialItems);
  const [expenses] = useState<Expense[]>(initialExpenses);

  // Track the baseline persisted state to avoid re-sending unchanged items
  const persistedItemsRef = useRef<Map<string, { day_number: number; order_index: number }>>(
    new Map(initialItems.map((it) => [it.id, { day_number: it.day_number, order_index: it.order_index }]))
  );

  useEffect(() => {
    persistedItemsRef.current = new Map(
      initialItems.map((it) => [it.id, { day_number: it.day_number, order_index: it.order_index }])
    );
  }, [initialItems]);

  useEffect(() => {
    setIsMounted(true);

    function handleExternalActivityAdded(e: Event) {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tripId === trip.id && customEvent.detail?.item) {
        const newItem = customEvent.detail.item;
        persistedItemsRef.current.set(newItem.id, {
          day_number: newItem.day_number,
          order_index: newItem.order_index,
        });
        setItems((prev) => {
          if (prev.some((i) => i.id === newItem.id)) return prev;
          return [...prev, newItem];
        });
        setSaveStatus("saved");
      }
    }

    window.addEventListener("trip:activity-added", handleExternalActivityAdded);
    return () => {
      window.removeEventListener("trip:activity-added", handleExternalActivityAdded);
    };
  }, [trip.id]);

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Modals state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isAISuggestModalOpen, setIsAISuggestModalOpen] = useState(false);
  const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [targetDayForNewActivity, setTargetDayForNewActivity] = useState(1);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);

  // Configure sensors for smooth drag + keyboard accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate total number of days
  const baseDays = useMemo(() => {
    let count = 3;
    if (trip.start_date && trip.end_date) {
      const s = new Date(trip.start_date);
      const e = new Date(trip.end_date);
      const diff =
        Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0) count = diff;
    }
    const maxItemDay = items.reduce(
      (m, i) => Math.max(m, i.day_number || 1),
      1
    );
    return Math.max(count, maxItemDay);
  }, [trip.start_date, trip.end_date, items]);

  const [extraDays, setExtraDays] = useState(0);
  const totalDays = baseDays + extraDays;

  // Group items by day
  const itemsByDay = useMemo(() => {
    const map: Record<number, ItineraryItem[]> = {};
    for (let d = 1; d <= totalDays; d++) {
      map[d] = [];
    }
    items.forEach((item) => {
      const d = item.day_number || 1;
      if (!map[d]) map[d] = [];
      map[d].push(item);
    });
    // Ensure sorted by order_index
    Object.keys(map).forEach((key) => {
      const d = Number(key);
      map[d].sort((a, b) => a.order_index - b.order_index);
    });
    return map;
  }, [items, totalDays]);

  // Overall totals separated by currency
  const { totalPlannedCost, otherCurrenciesTotal } = useMemo(() => {
    const primaryCurrency = (trip.currency || "USD").toUpperCase();
    let primarySum = 0;
    const others: Record<string, number> = {};

    items.forEach((item) => {
      const cost = Number(item.estimated_cost) || 0;
      if (cost <= 0) return;
      const itemCur = (item.currency || primaryCurrency).toUpperCase();
      if (itemCur === primaryCurrency) {
        primarySum += cost;
      } else {
        others[itemCur] = (others[itemCur] || 0) + cost;
      }
    });

    const otherList = Object.entries(others).map(([c, amt]) => `${c} ${amt.toLocaleString()}`);

    return { totalPlannedCost: primarySum, otherCurrenciesTotal: otherList };
  }, [items, trip.currency]);

  // Deterministic Trip Health Score (real-time recalculation on any itinerary/budget change)
  const tripHealth = useMemo(() => {
    return computeTripHealth({
      trip,
      items,
      stops,
      expenses,
    });
  }, [trip, items, stops, expenses]);

  // Calendar date for a day index
  function getDayDate(dayIndex: number): string | null {
    if (!trip.start_date) return null;
    const s = new Date(trip.start_date);
    s.setDate(s.getDate() + (dayIndex - 1));
    return s.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // Active item for DragOverlay
  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return items.find((i) => i.id === activeId) || null;
  }, [activeId, items]);

  /**
   * Batch persist reordered items to Supabase via server API
   */
  async function persistReorder(updatedItems: ItineraryItem[]) {
    // Only send items that actually changed day_number or order_index
    const changedItems = updatedItems.filter((item) => {
      const prev = persistedItemsRef.current.get(item.id);
      return (
        !prev ||
        prev.day_number !== item.day_number ||
        prev.order_index !== item.order_index
      );
    });

    if (changedItems.length === 0) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    setErrorNotice(null);

    // Chunk reorder updates safely in batches of up to 100 items (safely under the 200 API limit)
    const CHUNK_SIZE = 100;

    try {
      for (let i = 0; i < changedItems.length; i += CHUNK_SIZE) {
        const chunk = changedItems.slice(i, i + CHUNK_SIZE).map((item) => ({
          id: item.id,
          day_number: item.day_number,
          order_index: item.order_index,
        }));

        const res = await fetch(`/api/trips/${trip.id}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to persist reordering");
        }
      }

      // Synchronize the persisted baseline after successful database commit
      changedItems.forEach((item) => {
        persistedItemsRef.current.set(item.id, {
          day_number: item.day_number,
          order_index: item.order_index,
        });
      });

      setSaveStatus("saved");
    } catch (err: unknown) {
      console.error("Failed to persist reordering:", err);
      setSaveStatus("error");
      setErrorNotice(
        err instanceof Error ? err.message : "Error saving changes to database"
      );
    }
  }

  // --- Drag and Drop Handlers ---

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeItemId = String(active.id);
    const overId = String(over.id);

    const activeItemObj = items.find((i) => i.id === activeItemId);
    if (!activeItemObj) return;

    // Check if dragging over a day container (e.g., 'day-2')
    let targetDay: number | null = null;
    if (overId.startsWith("day-")) {
      targetDay = Number(overId.replace("day-", ""));
    } else {
      const overItem = items.find((i) => i.id === overId);
      if (overItem) {
        targetDay = overItem.day_number;
      }
    }

    if (!targetDay || activeItemObj.day_number === targetDay) {
      return;
    }

    // Moving across days optimistically during drag
    setItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id === activeItemId) {
          return {
            ...item,
            day_number: targetDay!,
            order_index: 9999, // temporary end position
          };
        }
        return item;
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItemId = String(active.id);
    const overId = String(over.id);

    const activeItemObj = items.find((i) => i.id === activeItemId);
    if (!activeItemObj) return;

    let targetDay = activeItemObj.day_number;
    if (overId.startsWith("day-")) {
      targetDay = Number(overId.replace("day-", ""));
    } else {
      const overItem = items.find((i) => i.id === overId);
      if (overItem) {
        targetDay = overItem.day_number;
      }
    }

    // Recompute order indices for target day
    const dayItems = items
      .filter((i) => i.day_number === targetDay && i.id !== activeItemId)
      .sort((a, b) => a.order_index - b.order_index);

    let insertIndex = dayItems.length;
    if (!overId.startsWith("day-")) {
      const targetIdx = dayItems.findIndex((i) => i.id === overId);
      if (targetIdx !== -1) {
        insertIndex = targetIdx;
      }
    }

    // Insert activeItem into dayItems at insertIndex
    const newDayItems = [
      ...dayItems.slice(0, insertIndex),
      { ...activeItemObj, day_number: targetDay },
      ...dayItems.slice(insertIndex),
    ];

    // Re-index target day
    const updatedWithIndices = newDayItems.map((item, idx) => ({
      ...item,
      order_index: idx,
    }));

    // Merge back into full items list
    const otherItems = items.filter(
      (i) => i.day_number !== targetDay && i.id !== activeItemId
    );

    // Also re-index source day if moved across days
    const sourceDay = activeItemObj.day_number;
    let finalOtherItems = otherItems;
    if (sourceDay !== targetDay) {
      const sourceDayItems = otherItems
        .filter((i) => i.day_number === sourceDay)
        .sort((a, b) => a.order_index - b.order_index)
        .map((item, idx) => ({ ...item, order_index: idx }));

      finalOtherItems = [
        ...otherItems.filter((i) => i.day_number !== sourceDay),
        ...sourceDayItems,
      ];
    }

    const nextAllItems = [...finalOtherItems, ...updatedWithIndices];
    setItems(nextAllItems);
    persistReorder(nextAllItems);
  }

  // --- Accessible Non-Drag Controls ---

  function handleMoveUp(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const day = item.day_number;
    const dayItems = items
      .filter((i) => i.day_number === day)
      .sort((a, b) => a.order_index - b.order_index);

    const index = dayItems.findIndex((i) => i.id === itemId);
    if (index <= 0) return;

    const reordered = arrayMove(dayItems, index, index - 1).map(
      (it, idx) => ({ ...it, order_index: idx })
    );

    const otherItems = items.filter((i) => i.day_number !== day);
    const updated = [...otherItems, ...reordered];
    setItems(updated);
    persistReorder(updated);
  }

  function handleMoveDown(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const day = item.day_number;
    const dayItems = items
      .filter((i) => i.day_number === day)
      .sort((a, b) => a.order_index - b.order_index);

    const index = dayItems.findIndex((i) => i.id === itemId);
    if (index === -1 || index >= dayItems.length - 1) return;

    const reordered = arrayMove(dayItems, index, index + 1).map(
      (it, idx) => ({ ...it, order_index: idx })
    );

    const otherItems = items.filter((i) => i.day_number !== day);
    const updated = [...otherItems, ...reordered];
    setItems(updated);
    persistReorder(updated);
  }

  function handleMoveToDay(itemId: string, targetDay: number) {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.day_number === targetDay) return;

    const sourceDay = item.day_number;

    // Remove from source and re-index
    const sourceItems = items
      .filter((i) => i.day_number === sourceDay && i.id !== itemId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((it, idx) => ({ ...it, order_index: idx }));

    // Append to target day
    const targetItems = items
      .filter((i) => i.day_number === targetDay)
      .sort((a, b) => a.order_index - b.order_index);

    const updatedTargetItems = [
      ...targetItems,
      {
        ...item,
        day_number: targetDay,
        order_index: targetItems.length,
      },
    ];

    const untouched = items.filter(
      (i) => i.day_number !== sourceDay && i.day_number !== targetDay
    );

    const updated = [...untouched, ...sourceItems, ...updatedTargetItems];
    setItems(updated);
    persistReorder(updated);
  }

  // --- CRUD API actions ---

  async function handleAddActivity(activityData: {
    title: string;
    description?: string;
    category: string;
    day_number: number;
    estimated_cost: number;
    start_time?: string;
    end_time?: string;
    notes?: string;
    activity_id?: string;
  }) {
    setSaveStatus("saving");
    setErrorNotice(null);

    const dayItems = itemsByDay[activityData.day_number] || [];
    const nextOrder = dayItems.length;

    const payload = {
      ...activityData,
      order_index: nextOrder,
      currency: trip.currency || "USD",
    };

    const res = await fetch(`/api/trips/${trip.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setSaveStatus("error");
      throw new Error(errData.error || "Failed to create activity item");
    }

    const { item: createdItem } = await res.json();
    if (createdItem?.id) {
      persistedItemsRef.current.set(createdItem.id, {
        day_number: createdItem.day_number,
        order_index: createdItem.order_index,
      });
    }
    setItems((prev) => [...prev, createdItem]);
    setSaveStatus("saved");
  }

  async function handleAddStop(stopData: {
    city_id?: string;
    custom_city_name?: string;
    arrival_date?: string;
    departure_date?: string;
    notes?: string;
  }) {
    setSaveStatus("saving");
    setErrorNotice(null);

    const res = await fetch(`/api/trips/${trip.id}/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...stopData,
        order_index: stops.length,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setSaveStatus("error");
      throw new Error(errData.error || "Failed to add destination stop");
    }

    const { stop: createdStop } = await res.json();
    setStops((prev) => [...prev, createdStop]);
    setSaveStatus("saved");
  }

  async function handleEditItem(
    itemId: string,
    updateData: Partial<ItineraryItem>
  ) {
    setSaveStatus("saving");
    setErrorNotice(null);

    const res = await fetch(`/api/trips/${trip.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setSaveStatus("error");
      throw new Error(errData.error || "Failed to update item");
    }

    const { item: updated } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    setSaveStatus("saved");
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("Are you sure you want to remove this activity?")) return;

    setSaveStatus("saving");
    setErrorNotice(null);

    try {
      const res = await fetch(`/api/trips/${trip.id}/items/${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete item");
      }

      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setSaveStatus("saved");
    } catch (err: unknown) {
      setSaveStatus("error");
      setErrorNotice(
        err instanceof Error ? err.message : "Error deleting activity"
      );
    }
  }

  async function handleToggleComplete(item: ItineraryItem) {
    await handleEditItem(item.id, { is_completed: !item.is_completed });
  }

  const stopsListLabels = stops
    .map((s) => s.custom_city_name || s.cities?.name)
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/trips"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Trips
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-sm text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              {trip.title}
            </span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[10px] border-blue-200 bg-blue-50 text-blue-700"
            >
              Builder
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Save indicator pill */}
            <div className="hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-slate-50 border-slate-200">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  <span className="text-slate-600 text-[11px]">Saving...</span>
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

            <Link href={`/trips/${trip.id}/view`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                View Plan
              </Button>
            </Link>
            <Link href={`/trips/${trip.id}/budget`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Budget
              </Button>
            </Link>
            <Link href={`/trips/${trip.id}/calendar`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Calendar
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareModalOpen(true)}
              className="text-xs h-8 gap-1.5 text-slate-700 hover:text-blue-600"
            >
              <Share2 className="h-3.5 w-3.5 text-blue-600" />
              Share
            </Button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Error Notification Banner */}
        {errorNotice && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorNotice}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => persistReorder(items)}
              className="text-xs h-7 border-rose-300 bg-white"
            >
              Retry Save
            </Button>
          </div>
        )}

        {/* Builder Toolbar & Trip Info Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className="text-xs border-blue-200 bg-blue-50 text-blue-700 font-semibold"
                >
                  {totalDays} Days
                </Badge>
                {stopsListLabels.length > 0 && (
                  <Badge variant="outline" className="text-xs text-slate-700 bg-slate-50">
                    <Route className="mr-1 h-3 w-3 text-slate-400" />
                    {stopsListLabels.join(" → ")}
                  </Badge>
                )}
                {trip.start_date && (
                  <Badge variant="outline" className="text-xs text-slate-600">
                    <Calendar className="mr-1 h-3 w-3 text-slate-400" />
                    {trip.start_date} {trip.end_date ? `to ${trip.end_date}` : ""}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {trip.title}
              </h1>

              {trip.description && (
                <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
                  {trip.description}
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStopModalOpen(true)}
                className="text-xs h-8.5 gap-1.5 border-slate-200 bg-white hover:bg-slate-50"
              >
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
                Add Stop
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setTargetDayForNewActivity(1);
                  setIsActivityModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8.5 gap-1.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Activity
              </Button>

              <Button
                size="sm"
                onClick={() => setIsAISuggestModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8.5 gap-1.5 shadow-xs font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                ✨ AI Smart Suggest
              </Button>

              <Button
                size="sm"
                onClick={() => setIsOptimizerModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8.5 gap-1.5 shadow-xs font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-200" />
                ✨ AI Optimizer
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setExtraDays((prev) => prev + 1)}
                className="text-xs h-8.5 gap-1 border-slate-200 bg-white"
                title="Add another day column to your itinerary"
              >
                <Plus className="h-3 w-3" />
                Add Day
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 border-t border-slate-100 pt-4 text-xs items-center">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Total Activities
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {items.length} {items.length === 1 ? "Item" : "Items"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Completed
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {items.filter((i) => i.is_completed).length} of {items.length}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Estimated Cost
              </span>
              <span className="font-bold text-emerald-600 text-sm">
                {trip.currency || "USD"} {totalPlannedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {otherCurrenciesTotal.length > 0 && (
                  <span className="text-[11px] font-normal text-slate-500 block">
                    + {otherCurrenciesTotal.join(", ")}
                  </span>
                )}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                Budget Remaining
              </span>
              <span
                className={`font-bold text-sm ${
                  Number(trip.total_budget || 0) - totalPlannedCost < 0
                    ? "text-rose-600"
                    : "text-slate-900"
                }`}
              >
                {trip.currency || "USD"}{" "}
                {(Number(trip.total_budget || 0) - totalPlannedCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <TripHealthBadge
                health={tripHealth}
                onClick={() => setIsHealthModalOpen(true)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Drag-and-Drop Workspace */}
        <DndContext
          id="globe-trotter-builder"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNum) => {
              const dayItems = itemsByDay[dayNum] || [];
              const dayDate = getDayDate(dayNum);
              // Associate stop if index matches stops order
              const assignedStop = stops[dayNum - 1] || null;

              return (
                <DroppableDayColumn
                  key={dayNum}
                  dayNumber={dayNum}
                  dayDate={dayDate}
                  items={dayItems}
                  totalDays={totalDays}
                  assignedStop={assignedStop}
                  tripCurrency={trip.currency}
                  onAddActivity={(d) => {
                    setTargetDayForNewActivity(d);
                    setIsActivityModalOpen(true);
                  }}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onMoveToDay={handleMoveToDay}
                  onEditItem={(item) => setEditingItem(item)}
                  onDeleteItem={handleDeleteItem}
                  onToggleComplete={handleToggleComplete}
                />
              );
            })}
          </div>

          {/* Drag Overlay for smooth ghost preview */}
          <DragOverlay>
            {activeItem ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-400 bg-white p-3.5 shadow-xl ring-2 ring-blue-500/20 rotate-1 cursor-grabbing">
                <div className="flex items-center gap-2.5">
                  <GripVertical className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 font-medium ${getCategoryBadgeClass(
                          activeItem.category
                        )}`}
                      >
                        {activeItem.category}
                      </Badge>
                      {activeItem.start_time && (
                        <span className="text-[10px] text-slate-500">
                          {formatTimeRange(activeItem.start_time, activeItem.end_time)}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 mt-0.5">
                      {activeItem.title}
                    </h4>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600">
                  {Number(activeItem.estimated_cost) > 0
                    ? formatCurrencyAmount(
                        Number(activeItem.estimated_cost),
                        activeItem.currency || trip.currency
                      )
                    : "Free"}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Modals */}
      <ActivitySearchModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        dayNumber={targetDayForNewActivity}
        totalDays={totalDays}
        tripCurrency={trip.currency}
        onSelectActivity={handleAddActivity}
      />

      <AISmartSuggestModal
        isOpen={isAISuggestModalOpen}
        onClose={() => setIsAISuggestModalOpen(false)}
        trip={trip}
        stops={stops}
        totalDays={totalDays}
        totalPlannedCost={totalPlannedCost}
        onSuccess={(newItems) => {
          setItems((prev) => [...prev, ...newItems]);
          setSaveStatus("saved");
        }}
      />

      <ItineraryOptimizerModal
        isOpen={isOptimizerModalOpen}
        onClose={() => setIsOptimizerModalOpen(false)}
        tripId={trip.id}
        tripTitle={trip.title}
        totalActivities={items.length}
        onSuccess={(updatedItems) => {
          setItems(updatedItems);
          setSaveStatus("saved");
        }}
      />

      <TripHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        tripId={trip.id}
        tripTitle={trip.title}
        health={tripHealth}
        onOpenOptimizer={() => setIsOptimizerModalOpen(true)}
      />

      <TripAssistantDrawer
        tripId={trip.id}
        tripTitle={trip.title}
        onActivityAdded={(newItem) => {
          setItems((prev) => {
            if (prev.some((i) => i.id === newItem.id)) return prev;
            return [...prev, newItem];
          });
          setSaveStatus("saved");
        }}
      />

      <AddStopModal
        isOpen={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        onAddStop={handleAddStop}
      />

      <EditItemModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onSave={handleEditItem}
      />

      <ShareTripModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        tripId={trip.id}
        tripTitle={trip.title}
        initialIsPublic={trip.is_public}
        initialShareSlug={trip.share_slug}
      />
    </div>
  );
}

