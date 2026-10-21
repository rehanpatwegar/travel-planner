"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Calendar, MapPin, DollarSign, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ItineraryItem, TripStop } from "./types";
import { SortableItineraryItem } from "./SortableItineraryItem";
import { formatCurrencyAmount } from "@/lib/utils";

interface DroppableDayColumnProps {
  dayNumber: number;
  dayDate?: string | null;
  items: ItineraryItem[];
  totalDays: number;
  assignedStop?: TripStop | null;
  tripCurrency?: string;
  onAddActivity: (dayNumber: number) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onMoveToDay: (itemId: string, targetDay: number) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onToggleComplete?: (item: ItineraryItem) => void;
}

export function DroppableDayColumn({
  dayNumber,
  dayDate,
  items,
  totalDays,
  assignedStop,
  tripCurrency,
  onAddActivity,
  onMoveUp,
  onMoveDown,
  onMoveToDay,
  onEditItem,
  onDeleteItem,
  onToggleComplete,
}: DroppableDayColumnProps) {
  const containerId = `day-${dayNumber}`;
  const { setNodeRef, isOver } = useDroppable({
    id: containerId,
  });

  const dayCostSummary = useMemo(() => {
    const sums: Record<string, number> = {};
    items.forEach((item) => {
      const cost = Number(item.estimated_cost) || 0;
      if (cost > 0) {
        const cur = (item.currency || tripCurrency || "USD").toUpperCase();
        sums[cur] = (sums[cur] || 0) + cost;
      }
    });
    const entries = Object.entries(sums);
    if (entries.length === 0) return null;
    return entries
      .map(([cur, amt]) => formatCurrencyAmount(amt, cur))
      .join(" + ");
  }, [items, tripCurrency]);

  const stopTitle =
    assignedStop?.custom_city_name ||
    assignedStop?.cities?.name ||
    null;

  return (
    <Card
      ref={setNodeRef}
      className={`border transition-all shadow-xs ${
        isOver
          ? "border-blue-400 bg-blue-50/20 ring-2 ring-blue-300/40"
          : "border-slate-200 bg-white"
      }`}
    >
      {/* Day Header */}
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
            Day {dayNumber}
          </span>

          {dayDate && (
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
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

          <span className="text-[11px] text-slate-400 font-medium">
            • {items.length} {items.length === 1 ? "activity" : "activities"}
          </span>

          {dayCostSummary && (
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
              {dayCostSummary} est.
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onAddActivity(dayNumber)}
          className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2 gap-1 font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Activity
        </Button>
      </CardHeader>

      {/* Sortable List of Activities */}
      <CardContent className="p-3 sm:p-4">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2.5 min-h-[48px]">
            {items.length === 0 ? (
              <div
                onClick={() => onAddActivity(dayNumber)}
                className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-7 px-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  <Plus className="h-4 w-4" />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
                  No activities planned for Day {dayNumber}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Drag items here or click to browse curated activities
                </p>
              </div>
            ) : (
              items.map((item, index) => (
                <SortableItineraryItem
                  key={item.id}
                  item={item}
                  dayNumber={dayNumber}
                  totalDays={totalDays}
                  tripCurrency={tripCurrency}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onMoveToDay={onMoveToDay}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
                  onToggleComplete={onToggleComplete}
                />
              ))
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

