"use client";

import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Clock,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItineraryItem } from "./types";

interface SortableItineraryItemProps {
  item: ItineraryItem;
  dayNumber: number;
  totalDays: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onMoveToDay: (itemId: string, targetDay: number) => void;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (itemId: string) => void;
  onToggleComplete?: (item: ItineraryItem) => void;
}

import { formatTimeRange, getCategoryBadgeClass } from "@/lib/utils";
export { formatTimeRange, getCategoryBadgeClass };

export function SortableItineraryItem({
  item,
  dayNumber,
  totalDays,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onMoveToDay,
  onEdit,
  onDelete,
  onToggleComplete,
}: SortableItineraryItemProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const timeText = formatTimeRange(item.start_time, item.end_time);
  const cost = Number(item.estimated_cost) || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-white p-3.5 transition-all shadow-xs hover:border-blue-200 hover:shadow-sm ${
        item.is_completed ? "border-slate-200 bg-slate-50/70" : "border-slate-200/90"
      }`}
    >
      {/* Left: Drag Handle + Details */}
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {/* Drag handle */}
        <button
          type="button"
          {...(isMounted ? attributes : {})}
          {...(isMounted ? listeners : {})}
          aria-label={`Drag to reorder ${item.title}`}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 focus:outline-hidden focus:text-blue-600 p-1 -ml-1 rounded transition-colors touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Completion toggle */}
        {onToggleComplete && (
          <button
            type="button"
            onClick={() => onToggleComplete(item)}
            className="mt-0.5 text-slate-300 hover:text-blue-600 transition-colors focus:outline-hidden"
            title={item.is_completed ? "Mark as planned" : "Mark as completed"}
          >
            {item.is_completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Metadata badges row */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge
              variant="outline"
              className={`text-[10px] font-medium border px-1.5 py-0 ${getCategoryBadgeClass(
                item.category
              )}`}
            >
              {item.category}
            </Badge>

            {timeText && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                <Clock className="h-3 w-3 text-slate-400" />
                {timeText}
              </span>
            )}
          </div>

          {/* Item Title */}
          <h4
            className={`mt-1 font-semibold text-sm tracking-tight truncate ${
              item.is_completed
                ? "text-slate-400 line-through"
                : "text-slate-900 group-hover:text-blue-600 transition-colors"
            }`}
          >
            {item.title}
          </h4>

          {/* Description or Notes */}
          {(item.description || item.notes) && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1 leading-relaxed">
              {item.description || item.notes}
            </p>
          )}
        </div>
      </div>

      {/* Right: Cost + Non-Drag Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {/* Cost display */}
        <div className="text-right">
          <span
            className={`text-xs font-bold ${
              cost === 0 ? "text-slate-400" : "text-emerald-600"
            }`}
          >
            {cost === 0 ? "Free" : `$${cost.toFixed(0)}`}
          </span>
        </div>

        {/* Action Controls & Non-drag accessibility */}
        <div className="flex items-center gap-1">
          {/* Reorder Up */}
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMoveUp(item.id)}
            title="Move item up"
            aria-label="Move item up"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>

          {/* Reorder Down */}
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMoveDown(item.id)}
            title="Move item down"
            aria-label="Move item down"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>

          {/* Move to another day dropdown (Accessible non-drag cross-day alternative) */}
          <select
            value={dayNumber}
            onChange={(e) => onMoveToDay(item.id, Number(e.target.value))}
            title="Move to another day"
            aria-label={`Move ${item.title} to another day`}
            className="h-6 text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-600 rounded px-1.5 focus:outline-hidden focus:border-blue-400 cursor-pointer"
          >
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>

          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Edit activity"
            aria-label="Edit activity details"
            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            title="Delete activity"
            aria-label="Delete activity"
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

