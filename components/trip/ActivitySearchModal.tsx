"use client";

import { useState, useEffect } from "react";
import {
  Search,
  X,
  Plus,
  Clock,
  DollarSign,
  MapPin,
  Star,
  Loader2,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ActivityCatalogItem } from "./types";
import { getCategoryBadgeClass } from "./SortableItineraryItem";

interface ActivitySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumber: number;
  totalDays: number;
  onSelectActivity: (activityData: {
    title: string;
    description?: string;
    category: string;
    day_number: number;
    estimated_cost: number;
    start_time?: string;
    end_time?: string;
    notes?: string;
    activity_id?: string;
  }) => Promise<void>;
}

const CATEGORIES = [
  "All",
  "Sightseeing",
  "Food & Dining",
  "Culture & History",
  "Adventure",
  "Nature",
  "Entertainment",
  "Shopping",
  "Relaxation",
];

export function ActivitySearchModal({
  isOpen,
  onClose,
  dayNumber: initialDay,
  totalDays,
  onSelectActivity,
}: ActivitySearchModalProps) {
  const [activeTab, setActiveTab] = useState<"catalog" | "custom">("catalog");
  const [selectedDay, setSelectedDay] = useState(initialDay);

  // Catalog state
  const [activities, setActivities] = useState<ActivityCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [addingId, setAddingId] = useState<string | null>(null);

  // Custom activity form state
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState("Sightseeing");
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");
  const [customCost, setCustomCost] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [submittingCustom, setSubmittingCustom] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDay(initialDay);
  }, [initialDay]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadCatalog() {
      if (activities.length > 0) return;
      setLoading(true);
      try {
        const res = await fetch("/api/activities");
        if (res.ok) {
          const data = await res.json();
          setActivities(data || []);
        }
      } catch (err) {
        console.error("Failed to load catalog activities:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, [isOpen, activities.length]);

  if (!isOpen) return null;

  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.city_name && act.city_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (act.description && act.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "All" || act.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  async function handleAddCatalogItem(act: ActivityCatalogItem) {
    setAddingId(act.id);
    setErrorMsg(null);
    try {
      await onSelectActivity({
        title: act.title,
        description: act.description,
        category: act.category,
        day_number: selectedDay,
        estimated_cost: act.estimated_cost,
        activity_id: act.id,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add activity");
    } finally {
      setAddingId(null);
    }
  }

  async function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customTitle.trim()) {
      setErrorMsg("Please enter an activity title");
      return;
    }

    setSubmittingCustom(true);
    setErrorMsg(null);
    try {
      await onSelectActivity({
        title: customTitle.trim(),
        category: customCategory,
        day_number: selectedDay,
        estimated_cost: parseFloat(customCost) || 0,
        start_time: customStartTime || undefined,
        end_time: customEndTime || undefined,
        notes: customNotes.trim() || undefined,
      });

      // Reset form
      setCustomTitle("");
      setCustomNotes("");
      setCustomCost("");
      setCustomStartTime("");
      setCustomEndTime("");
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save custom activity");
    } finally {
      setSubmittingCustom(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Activity</h3>
            <p className="text-xs text-slate-500">
              Browse curated experiences or create custom schedule plans.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Day Selector & Tabs Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-3">
          {/* Day selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Add to:</span>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-blue-700 shadow-xs focus:border-blue-400 focus:outline-hidden"
            >
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
            </select>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center rounded-lg bg-slate-200/60 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("catalog")}
              className={`rounded-md px-3 py-1.5 transition-all ${
                activeTab === "catalog"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Browse Catalog
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={`rounded-md px-3 py-1.5 transition-all ${
                activeTab === "custom"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Plan
            </button>
          </div>
        </div>

        {/* Error notice if present */}
        {errorMsg && (
          <div className="mx-6 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "catalog" ? (
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search activities, landmarks, or cities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-xs h-9 bg-slate-50/50"
                  />
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                        selectedCategory === cat
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity List */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="mt-2 text-xs">Loading activities...</span>
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs">No matching activities found.</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setActiveTab("custom")}
                    className="mt-1 text-xs text-blue-600"
                  >
                    Create a custom activity instead
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {filteredActivities.map((act) => (
                    <div
                      key={act.id}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-blue-200 hover:bg-slate-50/50 transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {act.image_url ? (
                          <img
                            src={act.image_url}
                            alt={act.title}
                            className="h-12 w-12 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                            <Layers className="h-5 w-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 font-medium ${getCategoryBadgeClass(
                                act.category
                              )}`}
                            >
                              {act.category}
                            </Badge>
                            {act.city_name && (
                              <span className="text-[11px] text-blue-600 font-medium flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {act.city_name}
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors mt-0.5 truncate">
                            {act.title}
                          </h4>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                            <span className="font-semibold text-emerald-600">
                              {act.estimated_cost === 0
                                ? "Free"
                                : `$${act.estimated_cost.toFixed(0)}`}
                            </span>
                            {act.duration_minutes > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {act.duration_minutes >= 60
                                  ? `${Math.floor(act.duration_minutes / 60)}h ${
                                      act.duration_minutes % 60
                                        ? `${act.duration_minutes % 60}m`
                                        : ""
                                    }`
                                  : `${act.duration_minutes}m`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        disabled={addingId === act.id}
                        onClick={() => handleAddCatalogItem(act)}
                        className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1 shrink-0"
                      >
                        {addingId === act.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Add to Day {selectedDay}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Custom Activity Form */
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Activity Title <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g., Sunrise Hike up Mount Pilatus"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-hidden focus:border-blue-400"
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimated Cost ($ USD)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={customCost}
                    onChange={(e) => setCustomCost(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Time (Optional)
                  </label>
                  <Input
                    type="time"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Time (Optional)
                  </label>
                  <Input
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes & Details (Optional)
                </label>
                <Textarea
                  placeholder="Add booking links, directions, meeting point, or notes..."
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="text-xs min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingCustom}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                >
                  {submittingCustom && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Activity to Day {selectedDay}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

