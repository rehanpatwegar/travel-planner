"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  Plus,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Layers,
  MapPin,
  HelpCircle,
  CheckCircle2,
  Trash2,
  Edit3,
  Receipt,
  Info,
  CalendarDays,
  LayoutDashboard,
  Check,
  X,
  CreditCard,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trip, TripStop, ItineraryItem, Expense } from "./types";
import { getCategoryBadgeClass } from "@/lib/utils";

interface TripBudgetClientProps {
  trip: Trip;
  items: ItineraryItem[];
  stops: TripStop[];
  expenses: Expense[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Sightseeing": "#2563eb",
  "Activities & Sightseeing": "#2563eb",
  "Activities": "#2563eb",
  "Culture & History": "#7c3aed",
  "Food & Dining": "#f59e0b",
  "Accommodation": "#0891b2",
  "Transportation": "#10b981",
  "Adventure": "#059669",
  "Shopping": "#e11d48",
  "Nature": "#16a34a",
  "Entertainment": "#9333ea",
  "Relaxation": "#06b6d4",
  "Miscellaneous": "#64748b",
};

const EXPENSE_CATEGORIES = [
  "Accommodation",
  "Activities",
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Miscellaneous",
] as const;

export function TripBudgetClient({
  trip: initialTrip,
  items: initialItems,
  stops,
  expenses: initialExpenses,
}: TripBudgetClientProps) {
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [items, setItems] = useState<ItineraryItem[]>(initialItems);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Budget Modal State
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(trip.total_budget || 0));
  const [currencyInput, setCurrencyInput] = useState(trip.currency || "USD");
  const [isSubmittingBudget, setIsSubmittingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  // Add Expense Modal State
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<string>("Accommodation");
  const [expenseDate, setExpenseDate] = useState("");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Deleting Expense State
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const currencySymbol = useMemo(() => {
    switch (trip.currency) {
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      case "JPY":
        return "¥";
      case "INR":
        return "₹";
      case "CAD":
      case "AUD":
      case "USD":
      default:
        return "$";
    }
  }, [trip.currency]);

  function formatCurrency(val: number) {
    return `${currencySymbol}${Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  // --- Calculations ---

  // 1. Activity Costs Breakdown
  const {
    activityTotalCost,
    unknownPriceItemsCount,
    freeItemsCount,
    knownPriceItemsCount,
  } = useMemo(() => {
    let total = 0;
    let unknown = 0;
    let free = 0;
    let known = 0;

    items.forEach((item) => {
      const rawCost = item.estimated_cost;
      if (rawCost === null || rawCost === undefined || isNaN(Number(rawCost))) {
        unknown++;
      } else if (Number(rawCost) === 0) {
        free++;
        known++;
      } else {
        total += Number(rawCost);
        known++;
      }
    });

    return {
      activityTotalCost: total,
      unknownPriceItemsCount: unknown,
      freeItemsCount: free,
      knownPriceItemsCount: known,
    };
  }, [items]);

  // 2. Custom Logged Expenses Total
  const loggedExpensesTotal = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenses]);

  // 3. Combined Estimated Trip Cost
  const totalEstimatedCost = activityTotalCost + loggedExpensesTotal;

  // 4. Budget Status
  const plannedBudget = Number(trip.total_budget || 0);
  const remainingBudget = plannedBudget - totalEstimatedCost;
  const budgetUtilization =
    plannedBudget > 0 ? (totalEstimatedCost / plannedBudget) * 100 : 0;

  // 5. Category Breakdown Data for Recharts
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};

    // Group itinerary items
    items.forEach((item) => {
      const cost = Number(item.estimated_cost);
      if (!isNaN(cost) && cost > 0) {
        const cat = item.category || "Sightseeing";
        map[cat] = (map[cat] || 0) + cost;
      }
    });

    // Group logged expenses
    expenses.forEach((exp) => {
      const cost = Number(exp.amount);
      if (!isNaN(cost) && cost > 0) {
        const cat = exp.category || "Miscellaneous";
        map[cat] = (map[cat] || 0) + cost;
      }
    });

    const result = Object.entries(map).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
      color: CATEGORY_COLORS[name] || "#3b82f6",
    }));

    result.sort((a, b) => b.value - a.value);
    return result;
  }, [items, expenses]);

  // 6. City Breakdown Data for Recharts
  const cityData = useMemo(() => {
    const map: Record<string, number> = {};

    stops.forEach((stop) => {
      const cityName =
        stop.custom_city_name || stop.cities?.name || "Destination";
      map[cityName] = 0;
    });

    items.forEach((item) => {
      const cost = Number(item.estimated_cost) || 0;
      if (cost > 0) {
        const stop = stops.find((s) => s.id === item.trip_stop_id);
        const cityName =
          stop?.custom_city_name ||
          stop?.cities?.name ||
          item.activities?.city_name ||
          "Multi-City / General";
        map[cityName] = (map[cityName] || 0) + cost;
      }
    });

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        estimatedCost: Math.round(value * 100) / 100,
      }))
      .filter((d) => d.estimatedCost > 0);
  }, [items, stops]);

  // 7. Days and Daily Burn
  const totalDays = useMemo(() => {
    if (trip.start_date && trip.end_date) {
      const s = new Date(trip.start_date);
      const e = new Date(trip.end_date);
      const diff =
        Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0) return diff;
    }
    const maxDay = items.reduce((m, i) => Math.max(m, i.day_number || 1), 1);
    return Math.max(1, maxDay);
  }, [trip.start_date, trip.end_date, items]);

  const dailyBurn = totalDays > 0 ? totalEstimatedCost / totalDays : 0;

  // --- Handlers ---

  async function handleUpdateBudget(e: React.FormEvent) {
    e.preventDefault();
    setBudgetError(null);
    const num = Number(budgetInput);

    if (isNaN(num) || num < 0) {
      setBudgetError("Please enter a valid positive budget number");
      return;
    }
    if (num > 100000000) {
      setBudgetError("Budget amount is unreasonably high");
      return;
    }

    setIsSubmittingBudget(true);

    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_budget: num,
          currency: currencyInput.trim().toUpperCase(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update planned budget");
      }

      const { trip: updated } = await res.json();
      setTrip(updated);
      setIsEditBudgetOpen(false);
    } catch (err: unknown) {
      setBudgetError(err instanceof Error ? err.message : "Error updating budget");
    } finally {
      setIsSubmittingBudget(false);
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setExpenseError(null);

    if (!expenseTitle.trim()) {
      setExpenseError("Please enter an expense title");
      return;
    }

    const num = Number(expenseAmount);
    if (isNaN(num) || num < 0) {
      setExpenseError("Please enter a valid positive amount");
      return;
    }

    setIsSubmittingExpense(true);

    try {
      const res = await fetch(`/api/trips/${trip.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: expenseTitle.trim(),
          amount: num,
          category: expenseCategory,
          currency: trip.currency || "USD",
          expense_date: expenseDate || null,
          payment_method: expensePaymentMethod.trim() || null,
          notes: expenseNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to record expense");
      }

      const { expense: newExp } = await res.json();
      setExpenses((prev) => [newExp, ...prev]);

      // Reset form
      setExpenseTitle("");
      setExpenseAmount("");
      setExpenseDate("");
      setExpensePaymentMethod("");
      setExpenseNotes("");
      setIsAddExpenseOpen(false);
    } catch (err: unknown) {
      setExpenseError(
        err instanceof Error ? err.message : "Error recording expense"
      );
    } finally {
      setIsSubmittingExpense(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!confirm("Are you sure you want to remove this expense entry?")) return;

    setDeletingExpenseId(expenseId);

    try {
      const res = await fetch(`/api/trips/${trip.id}/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete expense");
      }

      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    } catch (err) {
      console.error("Failed to delete expense:", err);
      alert("Error removing expense");
    } finally {
      setDeletingExpenseId(null);
    }
  }

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
            <span className="font-bold text-sm text-slate-900 truncate max-w-[180px] sm:max-w-md">
              {trip.title}
            </span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700"
            >
              Budget Analytics
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button size="sm" variant="ghost" className="text-xs h-8 gap-1.5 text-slate-600">
                <LayoutDashboard className="h-3.5 w-3.5 text-slate-400" />
                Dashboard
              </Button>
            </Link>
            <Link href={`/trips/${trip.id}/calendar`}>
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-indigo-600" />
                Calendar
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

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Banner with Trip Overview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className="text-xs border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold"
                >
                  <DollarSign className="mr-1 h-3 w-3" />
                  Trip Budget & Expense Analytics
                </Badge>
                {trip.start_date && (
                  <Badge variant="outline" className="text-xs text-slate-600">
                    <Calendar className="mr-1 h-3 w-3 text-slate-400" />
                    {totalDays} {totalDays === 1 ? "Day" : "Days"}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                  Currency: {trip.currency || "USD"}
                </Badge>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {trip.title} Financial Dashboard
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Track planned target budget against estimated itinerary activities and logged expenses.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBudgetInput(String(trip.total_budget || 0));
                  setCurrencyInput(trip.currency || "USD");
                  setIsEditBudgetOpen(true);
                }}
                className="text-xs h-8.5 gap-1.5 border-slate-200 bg-white"
              >
                <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                Set / Edit Budget
              </Button>

              <Button
                size="sm"
                onClick={() => setIsAddExpenseOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8.5 gap-1.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Expense
              </Button>
            </div>
          </div>
        </div>

        {/* Disclaimer Note */}
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900">
          <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold">Estimates Disclaimer:</strong> All amounts shown are planned estimates based on catalog data and logged records. Actual live rates, booking fees, seasonal surcharges, and taxes may vary. These totals do not represent confirmed bookings.
          </div>
        </div>

        {/* Financial Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Target Budget */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Target Budget
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-900">
                {plannedBudget > 0 ? formatCurrency(plannedBudget) : "No Target Set"}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>Allocated limit</span>
                <button
                  type="button"
                  onClick={() => setIsEditBudgetOpen(true)}
                  className="text-blue-600 hover:underline text-[11px] font-medium"
                >
                  Adjust
                </button>
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Estimated Total Cost */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Total Estimated Cost
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-blue-600">
                {formatCurrency(totalEstimatedCost)}
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate">
                Activities: {formatCurrency(activityTotalCost)} • Logged: {formatCurrency(loggedExpensesTotal)}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Remaining Buffer */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Remaining Budget
              </span>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-black ${
                  plannedBudget === 0
                    ? "text-slate-400"
                    : remainingBudget >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {plannedBudget === 0
                  ? "—"
                  : remainingBudget >= 0
                  ? formatCurrency(remainingBudget)
                  : `-${formatCurrency(Math.abs(remainingBudget))}`}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {plannedBudget === 0 ? (
                  "Set a budget to see buffer"
                ) : remainingBudget >= 0 ? (
                  <span className="text-emerald-700 font-medium">Under target budget</span>
                ) : (
                  <span className="text-rose-700 font-medium">Over target budget</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Daily Burn Pacing */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Est. Daily Burn
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-900">
                {formatCurrency(dailyBurn)}
                <span className="text-xs text-slate-500 font-normal"> / day</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Averaged across {totalDays} {totalDays === 1 ? "day" : "days"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Budget Progress Bar if Target Set */}
        {plannedBudget > 0 && (
          <Card className="border-slate-200 bg-white shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Budget Utilization:</span>
                <span className="font-semibold text-slate-600">
                  {budgetUtilization.toFixed(1)}% committed
                </span>
              </div>
              <span className="text-slate-500">
                {formatCurrency(totalEstimatedCost)} of {formatCurrency(plannedBudget)} planned
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  budgetUtilization > 100
                    ? "bg-rose-500"
                    : budgetUtilization > 85
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, budgetUtilization)}%` }}
              />
            </div>
          </Card>
        )}

        {/* Unknown Prices Notice Banner */}
        {unknownPriceItemsCount > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Incomplete Price Data:</strong> {unknownPriceItemsCount}{" "}
                {unknownPriceItemsCount === 1 ? "activity has" : "activities have"}{" "}
                unspecified / unknown prices and are excluded from this total.
              </span>
            </div>
            <Link href={`/trips/${trip.id}/builder`}>
              <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 bg-white text-amber-900">
                Update in Builder
              </Button>
            </Link>
          </div>
        )}

        {/* Visual Analytics / Charts Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Chart 1: Category Distribution */}
          <Card className="border-slate-200 bg-white shadow-xs flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Spending by Category
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Distribution of planned activities and logged expenses.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 flex-1 flex flex-col justify-center">
              {categoryData.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 italic">
                  No estimated costs or expenses logged yet.
                </div>
              ) : isMounted ? (
                <div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={45}
                          paddingAngle={3}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [formatCurrency(Number(value)), "Amount"]}
                          contentStyle={{
                            borderRadius: "0.5rem",
                            fontSize: "12px",
                            backgroundColor: "#ffffff",
                            borderColor: "#e2e8f0",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Accessible Category Breakdown Table / List */}
                  <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {categoryData.map((cat) => {
                      const percent =
                        totalEstimatedCost > 0
                          ? ((cat.value / totalEstimatedCost) * 100).toFixed(1)
                          : "0";
                      return (
                        <div
                          key={cat.name}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="font-medium text-slate-700 truncate">
                              {cat.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-right">
                            <span className="text-slate-400 text-[11px]">{percent}%</span>
                            <span className="font-bold text-slate-900">
                              {formatCurrency(cat.value)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                  Loading chart...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart 2: Destination / City Spending Comparison */}
          <Card className="border-slate-200 bg-white shadow-xs flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Spending by Destination City
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Estimated activities budget allocated per stop.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 flex-1 flex flex-col justify-center">
              {cityData.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 italic">
                  No city stops with activity cost data found.
                </div>
              ) : isMounted ? (
                <div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cityData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          angle={-15}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          tickFormatter={(v) => `${currencySymbol}${v}`}
                        />
                        <Tooltip
                          formatter={(value: any) => [formatCurrency(Number(value)), "Estimated Cost"]}
                          contentStyle={{
                            borderRadius: "0.5rem",
                            fontSize: "12px",
                            backgroundColor: "#ffffff",
                            borderColor: "#e2e8f0",
                          }}
                        />
                        <Bar
                          dataKey="estimatedCost"
                          name="Estimated Cost"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary list */}
                  <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {cityData.map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-medium text-slate-700 flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {c.name}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(c.estimatedCost)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                  Loading chart...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Expenses List & Activity Estimates Tabs / Sections */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Custom Logged Expenses (2 columns) */}
          <Card className="border-slate-200 bg-white shadow-xs lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-4 px-5">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-600" />
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Logged Trip Expenses
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Actual or budgeted lodging, transit, and miscellaneous receipts.
                  </CardDescription>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddExpenseOpen(true)}
                className="text-xs h-7 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              >
                <Plus className="h-3 w-3" />
                Add Expense
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {expenses.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs text-slate-400 italic">
                    No custom expenses logged yet. Add flights, hotel bookings, or transit passes here.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAddExpenseOpen(true)}
                    className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    + Add your first expense
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 hover:bg-slate-50/70 transition-colors text-xs"
                    >
                      <div className="space-y-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">
                            {expense.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 border-slate-200 text-slate-600"
                          >
                            {expense.category}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {expense.expense_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {expense.expense_date}
                            </span>
                          )}
                          {expense.payment_method && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="h-2.5 w-2.5" />
                              {expense.payment_method}
                            </span>
                          )}
                          {expense.notes && (
                            <span className="truncate max-w-xs text-slate-500">
                              • {expense.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrency(Number(expense.amount))}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteExpense(expense.id)}
                          disabled={deletingExpenseId === expense.id}
                          className="h-7 w-7 p-0 text-slate-300 hover:text-rose-600 transition-colors"
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Planned Itinerary Activities Estimates (1 column) */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 py-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Itinerary Estimates
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    From planned sightseeing & tours.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {items.length} Activities
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No itinerary activities planned yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {items.map((item) => {
                    const cost = item.estimated_cost;
                    const hasCost = cost !== null && cost !== undefined && !isNaN(Number(cost));

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 hover:bg-slate-50/70 transition-colors text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-slate-800 truncate block">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Day {item.day_number || 1} • {item.category}
                          </span>
                        </div>

                        <div className="shrink-0 text-right">
                          {hasCost ? (
                            Number(cost) === 0 ? (
                              <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                                Free
                              </Badge>
                            ) : (
                              <span className="font-bold text-slate-900">
                                {formatCurrency(Number(cost))}
                              </span>
                            )
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-500 border-slate-200">
                              Unknown
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Budget Modal */}
      {isEditBudgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Update Planned Target Budget
              </h3>
              <button
                type="button"
                onClick={() => setIsEditBudgetOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBudget} className="space-y-4 text-xs">
              {budgetError && (
                <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-[11px]">
                  {budgetError}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Planned Budget Amount ({currencyInput})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100000000"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  placeholder="e.g. 2500"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Currency Code
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase"
                  placeholder="USD, EUR, GBP, JPY"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditBudgetOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingBudget}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  {isSubmittingBudget ? "Saving..." : "Save Budget"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Log New Trip Expense
              </h3>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs">
              {expenseError && (
                <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-[11px]">
                  {expenseError}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  placeholder="e.g. Hotel Le Meurice 3 Nights"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Amount ({trip.currency || "USD"}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    placeholder="e.g. 450"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Category *
                  </label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Date Incurred (Optional)
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Payment Method (Optional)
                  </label>
                  <input
                    type="text"
                    value={expensePaymentMethod}
                    onChange={(e) => setExpensePaymentMethod(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    placeholder="e.g. Credit Card, Cash"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  placeholder="Booking reference, receipt info, etc."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingExpense}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  {isSubmittingExpense ? "Recording..." : "Record Expense"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

