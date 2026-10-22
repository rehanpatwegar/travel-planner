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
  Hotel,
  Plane,
  Utensils,
  Compass,
  ShoppingBag,
  User,
  Users,
  Scale,
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
import { Trip, TripStop, ItineraryItem, Expense, TripMember } from "./types";
import { getCategoryBadgeClass, getCurrencySymbol, formatCurrencyAmount } from "@/lib/utils";
import {
  computeRealBudgetBreakdown,
  getPillarLabel,
  estimateTripBenchmarkBudget,
  type BudgetPillarKey,
} from "@/lib/budget/budgetEngine";
import {
  calculateEqualSplit,
  toCents,
  fromCents,
} from "@/lib/budget/splitEngine";
import { PriceConfidenceBadge } from "./PriceConfidenceBadge";
import { CostSavingModal } from "./CostSavingModal";
import { TripMembersCard } from "./TripMembersCard";
import { GroupSplitBalancesCard } from "./GroupSplitBalancesCard";

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

const PILLAR_CONFIG: Record<
  BudgetPillarKey,
  { label: string; icon: typeof Hotel; bg: string; text: string }
> = {
  accommodation: {
    label: "Accommodation",
    icon: Hotel,
    bg: "bg-cyan-50",
    text: "text-cyan-700",
  },
  transport: {
    label: "Transport",
    icon: Plane,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  food: {
    label: "Food & Dining",
    icon: Utensils,
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  activities: {
    label: "Activities & Sightseeing",
    icon: Compass,
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  other: {
    label: "Other Expenses",
    icon: ShoppingBag,
    bg: "bg-slate-100",
    text: "text-slate-700",
  },
};

export function TripBudgetClient({
  trip: initialTrip,
  items: initialItems,
  stops,
  expenses: initialExpenses,
}: TripBudgetClientProps) {
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [items, setItems] = useState<ItineraryItem[]>(initialItems);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

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
  const [expenseCurrency, setExpenseCurrency] = useState<string>(trip.currency || "USD");
  const [expenseDate, setExpenseDate] = useState("");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseItineraryItemId, setExpenseItineraryItemId] = useState<string>("");
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Group Trip Split Fields for Expense Modal
  const [paidByMemberId, setPaidByMemberId] = useState<string>("");
  const [splitMode, setSplitMode] = useState<"none" | "equal" | "custom">("none");
  const [equalParticipantIds, setEqualParticipantIds] = useState<string[]>([]);
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  // Deleting Expense State
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deleteExpenseError, setDeleteExpenseError] = useState<string | null>(null);

  // Cost Saving 30% Modal State
  const [isCostSavingModalOpen, setIsCostSavingModalOpen] = useState(false);

  // Re-fetch persisted expenses and members
  async function refreshExpenses() {
    try {
      const res = await fetch(`/api/trips/${trip.id}/expenses`);
      if (res.ok) {
        const data = await res.json();
        if (data.expenses) {
          setExpenses(data.expenses);
        }
      }
    } catch (err) {
      console.error("Failed to refresh expenses:", err);
    }
  }

  // Initial load of members (with auto-initialization) and enriched expenses
  useEffect(() => {
    let isCurrent = true;
    async function loadGroupData() {
      setIsLoadingMembers(true);
      try {
        const [membersRes, expensesRes] = await Promise.all([
          fetch(`/api/trips/${trip.id}/members`),
          fetch(`/api/trips/${trip.id}/expenses`),
        ]);

        if (!isCurrent) return;

        if (membersRes.ok) {
          const mData = await membersRes.json();
          if (mData.members) {
            setMembers(mData.members);
          }
        }

        if (expensesRes.ok) {
          const eData = await expensesRes.json();
          if (eData.expenses) {
            setExpenses(eData.expenses);
          }
        }
      } catch (err) {
        console.error("Error loading group split data:", err);
      } finally {
        if (isCurrent) {
          setIsLoadingMembers(false);
        }
      }
    }

    loadGroupData();
    return () => {
      isCurrent = false;
    };
  }, [trip.id]);

  function handleOpenAddExpense() {
    setExpenseError(null);
    const ownerMember = members.find((m) => m.role === "owner") || members[0];
    if (ownerMember) {
      setPaidByMemberId(ownerMember.id);
    } else {
      setPaidByMemberId("");
    }

    if (members.length > 0) {
      setEqualParticipantIds(members.map((m) => m.id));
      const initialCustom: Record<string, string> = {};
      members.forEach((m) => {
        initialCustom[m.id] = "";
      });
      setCustomShares(initialCustom);
    }

    setSplitMode(members.length > 1 ? "equal" : "none");
    setIsAddExpenseOpen(true);
  }

  // Equal split real-time calculation preview
  const equalSplitPreview = useMemo(() => {
    const costNum = Number(expenseAmount);
    if (isNaN(costNum) || costNum <= 0 || equalParticipantIds.length === 0) {
      return null;
    }
    try {
      return calculateEqualSplit(costNum, equalParticipantIds);
    } catch {
      return null;
    }
  }, [expenseAmount, equalParticipantIds]);

  // Custom split real-time balance calculations
  const targetExpenseCents = useMemo(() => {
    const num = Number(expenseAmount);
    return isNaN(num) || num <= 0 ? 0 : toCents(num);
  }, [expenseAmount]);

  const customAllocatedCents = useMemo(() => {
    return members.reduce((sum, m) => {
      const val = customShares[m.id];
      const num = Number(val);
      return sum + (isNaN(num) || num < 0 ? 0 : toCents(num));
    }, 0);
  }, [members, customShares]);

  const customDiscrepancyCents = targetExpenseCents - customAllocatedCents;

  const primaryCurrency = useMemo(
    () => (trip.currency || "USD").trim().toUpperCase(),
    [trip.currency]
  );

  const currencySymbol = useMemo(
    () => getCurrencySymbol(primaryCurrency),
    [primaryCurrency]
  );

  function formatCurrency(val: number, cur?: string) {
    return formatCurrencyAmount(val, cur || primaryCurrency);
  }

  // --- Real Budget Engine Calculations (5-Pillar Breakdown, Double-Counting Free) ---
  const budgetBreakdown = useMemo(() => {
    return computeRealBudgetBreakdown({
      trip,
      items,
      expenses,
    });
  }, [trip, items, expenses]);

  const totalEstimatedCost = budgetBreakdown.totalCommitted;
  const plannedBudget = budgetBreakdown.targetBudget;
  const remainingBudget = budgetBreakdown.remainingBudget;
  const budgetUtilization = budgetBreakdown.budgetUtilization;
  const unknownPriceItemsCount = budgetBreakdown.unknownPriceCount;
  const otherCurrenciesSummary = budgetBreakdown.otherCurrenciesFormatted;
  const activityTotalCost = budgetBreakdown.totalPlanned;
  const loggedExpensesTotal = budgetBreakdown.totalActuals;

  // Required cost categories check
  const hasLodging = useMemo(() => {
    return (
      budgetBreakdown.pillars.accommodation.totalCommitted > 0 ||
      expenses.some((e) => /accommodat|hotel|hostel|resort|lodging/i.test(e.category || "")) ||
      items.some((i) => /accommodat|hotel|hostel|resort|lodging/i.test(i.category || ""))
    );
  }, [budgetBreakdown, expenses, items]);

  const hasTransport = useMemo(() => {
    return (
      budgetBreakdown.pillars.transport.totalCommitted > 0 ||
      expenses.some((e) => /transport|transit|flight|train|bus|ferry|taxi|car/i.test(e.category || "")) ||
      items.some((i) => /transport|transit|flight|train|bus|ferry|taxi|car/i.test(i.category || ""))
    );
  }, [budgetBreakdown, expenses, items]);

  const isBudgetAssessmentComplete = hasLodging && hasTransport && unknownPriceItemsCount === 0;

  // Destination benchmark estimate for unrecorded categories / reference
  const destinationBenchmark = useMemo(() => {
    const destName = stops.length > 0
      ? (stops[0].custom_city_name || stops[0].cities?.name || trip.title)
      : trip.title;
    return estimateTripBenchmarkBudget({
      destination: destName,
      startDate: trip.start_date,
      endDate: trip.end_date,
      currency: trip.currency,
      travelersCount: members.length > 0 ? members.length : 2,
      destinationsCount: stops.length > 0 ? stops.length : 1,
      userBudget: trip.total_budget ? Number(trip.total_budget) : undefined,
    });
  }, [stops, trip.title, trip.start_date, trip.end_date, trip.currency, trip.total_budget, members.length]);

  // 5-Pillar Distribution Data for Recharts
  const categoryData = useMemo(() => {
    const colors: Record<BudgetPillarKey, string> = {
      accommodation: "#0891b2", // cyan-600
      transport: "#10b981",     // emerald-500
      food: "#f59e0b",          // amber-500
      activities: "#2563eb",    // blue-600
      other: "#64748b",         // slate-500
    };

    const list: Array<{ name: string; value: number; color: string }> = [];

    (Object.keys(budgetBreakdown.pillars) as BudgetPillarKey[]).forEach((key) => {
      const p = budgetBreakdown.pillars[key];
      if (p.totalCommitted > 0) {
        list.push({
          name: p.label,
          value: p.totalCommitted,
          color: colors[key],
        });
      }
    });

    list.sort((a, b) => b.value - a.value);
    return list;
  }, [budgetBreakdown]);

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
      const itemCur = (item.currency || primaryCurrency).toUpperCase();
      if (cost > 0 && itemCur === primaryCurrency) {
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
  }, [items, stops, primaryCurrency]);

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

    if (splitMode === "equal") {
      if (equalParticipantIds.length === 0) {
        setExpenseError("Please select at least one participant to split this expense.");
        return;
      }
    } else if (splitMode === "custom") {
      if (targetExpenseCents <= 0) {
        setExpenseError("Please enter an expense amount greater than zero for custom splitting.");
        return;
      }
      if (customDiscrepancyCents !== 0) {
        setExpenseError(
          `Custom split allocations must match the total expense amount. Discrepancy: ${formatCurrency(
            fromCents(Math.abs(customDiscrepancyCents)),
            expenseCurrency
          )}`
        );
        return;
      }
    }

    setIsSubmittingExpense(true);

    try {
      const payload: Record<string, any> = {
        title: expenseTitle.trim(),
        amount: num,
        category: expenseCategory,
        currency: (expenseCurrency || trip.currency || "USD").trim().toUpperCase(),
        expense_date: expenseDate || null,
        payment_method: expensePaymentMethod.trim() || null,
        notes: expenseNotes.trim() || null,
        itinerary_item_id: expenseItineraryItemId || null,
        paid_by_member_id: paidByMemberId || null,
      };

      if (splitMode === "equal" && equalParticipantIds.length > 0) {
        payload.split_type = "equal";
        payload.split_member_ids = equalParticipantIds;
      } else if (splitMode === "custom") {
        payload.split_type = "custom";
        payload.custom_splits = members.map((m) => ({
          member_id: m.id,
          amount: Number(customShares[m.id]) || 0,
        }));
      }

      const res = await fetch(`/api/trips/${trip.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to record expense");
      }

      // Re-fetch persisted expenses to maintain 100% server sync
      await refreshExpenses();

      // Reset form
      setExpenseTitle("");
      setExpenseAmount("");
      setExpenseDate("");
      setExpensePaymentMethod("");
      setExpenseNotes("");
      setExpenseItineraryItemId("");
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
    setDeleteExpenseError(null);

    try {
      const res = await fetch(`/api/trips/${trip.id}/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete expense");
      }

      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      await refreshExpenses();
    } catch (err) {
      console.error("Failed to delete expense:", err);
      setDeleteExpenseError(err instanceof Error ? err.message : "Error removing expense");
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
                size="sm"
                onClick={() => setIsCostSavingModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8.5 gap-1.5 shadow-xs font-semibold"
                title="Explore data-driven activity substitutions to achieve 30% planned savings"
              >
                <TrendingDown className="h-3.5 w-3.5 text-emerald-200" />
                ✨ Make 30% Cheaper
              </Button>

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
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8.5 gap-1.5 shadow-xs"
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
              {otherCurrenciesSummary.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-amber-800">
                  <span className="font-semibold">Other Currencies: </span>
                  {otherCurrenciesSummary.join(", ")}
                </div>
              )}
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
                  isBudgetAssessmentComplete ? (
                    <span className="text-emerald-700 font-medium">Under target budget</span>
                  ) : (
                    <span className="text-amber-700 font-medium">Preliminary (lodging/transit not logged)</span>
                  )
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

        {/* Missing Required Categories Warning Banner (Task 5) */}
        {!isBudgetAssessmentComplete && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold">Preliminary Budget Assessment:</strong> Target budget comparison is incomplete.{" "}
                {[
                  !hasLodging ? "Accommodation / Lodging expenses" : "",
                  !hasTransport ? "Transportation / Transit" : "",
                  unknownPriceItemsCount > 0 ? `${unknownPriceItemsCount} unpriced activity(ies)` : "",
                ]
                  .filter(Boolean)
                  .join(" and ")}{" "}
                are not yet recorded. Do not assume your trip is fully within budget until all required cost categories are accounted for.
              </div>
            </div>

            {/* Destination Cost Baseline Guide */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">Typical Destination Baseline (Reference Only)</span>
                  <Badge variant="outline" className="text-[10px] border-slate-300 bg-white">
                    {destinationBenchmark.totalDays} Days • {destinationBenchmark.travelersCount} Traveler(s)
                  </Badge>
                </div>
                <span className="font-bold text-slate-900">
                  Est. Baseline: {destinationBenchmark.primaryCurrency}{" "}
                  {destinationBenchmark.totalEstimatedCost.toLocaleString()}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-white rounded-md p-2 border border-slate-200/60">
                  <span className="text-slate-400 block font-medium">Accommodation ({destinationBenchmark.roomsCount} room)</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    ~{destinationBenchmark.primaryCurrency} {destinationBenchmark.breakdown.accommodation.total.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white rounded-md p-2 border border-slate-200/60">
                  <span className="text-slate-400 block font-medium">Food & Dining (3 meals/day)</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    ~{destinationBenchmark.primaryCurrency} {destinationBenchmark.breakdown.food.total.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white rounded-md p-2 border border-slate-200/60">
                  <span className="text-slate-400 block font-medium">Local & Rail Transit</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    ~{destinationBenchmark.primaryCurrency} {destinationBenchmark.breakdown.transport.total.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white rounded-md p-2 border border-slate-200/60">
                  <span className="text-slate-400 block font-medium">Activities + Buffer</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    ~{destinationBenchmark.primaryCurrency} {(destinationBenchmark.breakdown.activities.total + destinationBenchmark.breakdown.contingencyBuffer.total).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-500 italic">
                Indicative market estimate for travel planning. Live prices, hotel rates, and ticket availability vary by booking window and season.
              </p>
            </div>
          </div>
        )}

        {/* Multi-Currency Separation Notice (Task 1) */}
        {otherCurrenciesSummary.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs text-blue-900">
            <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold">Multiple Currencies Tracked Separately:</strong> In addition to your primary budget in {primaryCurrency}, you have entries in other currencies ({otherCurrenciesSummary.join(", ")}). To prevent inaccurate estimations, these amounts are tracked separately and not added into {primaryCurrency} without verified exchange rates.
            </div>
          </div>
        )}

        {/* Five-Pillar Real Budget Breakdown Matrix */}
        <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
          <CardHeader className="border-b border-slate-100 py-4 px-5 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Real Budget Breakdown by Pillar
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Standardized 5-pillar overview comparing planned estimates against actual receipts.
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={() => setIsCostSavingModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 font-semibold shadow-xs shrink-0"
              >
                <TrendingDown className="h-3.5 w-3.5 text-emerald-200" />
                ✨ Make 30% Cheaper
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Pillar</th>
                  <th className="py-3 px-4 text-right">Planned (Pending)</th>
                  <th className="py-3 px-4 text-right">Actual (Logged)</th>
                  <th className="py-3 px-4 text-right">Committed Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(Object.keys(budgetBreakdown.pillars) as BudgetPillarKey[]).map((key) => {
                  const p = budgetBreakdown.pillars[key];
                  const config = PILLAR_CONFIG[key];
                  const Icon = config.icon;

                  return (
                    <tr key={key} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bg} ${config.text} shrink-0`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{p.label}</span>
                            <span className="text-[10px] text-slate-400">
                              {p.itemCount} {p.itemCount === 1 ? "activity" : "activities"} • {p.expenseCount} {p.expenseCount === 1 ? "receipt" : "receipts"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                        {formatCurrency(p.plannedCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                        {formatCurrency(p.actualCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(p.totalCommitted)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {p.unpricedCount > 0 ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 text-[10px]">
                            {p.unpricedCount} unpriced
                          </Badge>
                        ) : p.totalCommitted > 0 ? (
                          <span className="text-emerald-700 text-[11px] font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Accounted
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No spending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-xs text-slate-900">
                  <td className="py-3 px-4">Trip Total ({primaryCurrency})</td>
                  <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(activityTotalCost)}</td>
                  <td className="py-3 px-4 text-right text-slate-900">{formatCurrency(loggedExpensesTotal)}</td>
                  <td className="py-3 px-4 text-right text-indigo-700 text-sm font-extrabold">{formatCurrency(totalEstimatedCost)}</td>
                  <td className="py-3 px-4 text-center">
                    {unknownPriceItemsCount > 0 ? (
                      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900 text-[10px]">
                        {unknownPriceItemsCount} Unpriced Total
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">
                        Fully Priced
                      </Badge>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

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

        {/* Group Expense Split & Travel Companions Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <TripMembersCard
              tripId={trip.id}
              members={members}
              loading={isLoadingMembers}
              onMembersChange={setMembers}
              onExpenseRefreshNeeded={refreshExpenses}
            />
          </div>
          <div className="lg:col-span-2">
            <GroupSplitBalancesCard
              members={members}
              expenses={expenses}
              primaryCurrency={primaryCurrency}
            />
          </div>
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
                onClick={handleOpenAddExpense}
                className="text-xs h-7 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              >
                <Plus className="h-3 w-3" />
                Add Expense
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {deleteExpenseError && (
                <div className="m-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600 mt-0.5" />
                  <p>{deleteExpenseError}</p>
                </div>
              )}
              {expenses.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs text-slate-400 italic">
                    No custom expenses logged yet. Add flights, hotel bookings, or transit passes here.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleOpenAddExpense}
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 truncate">
                            {expense.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 border-slate-200 text-slate-600"
                          >
                            {expense.category}
                          </Badge>
                          {expense.paid_by && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 border-blue-200 bg-blue-50 text-blue-700 font-medium inline-flex items-center gap-1"
                            >
                              <User className="h-2.5 w-2.5" />
                              Paid by {expense.paid_by.display_name}
                            </Badge>
                          )}
                          {expense.itinerary_item_id && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 border-emerald-200 bg-emerald-50 text-emerald-700 font-medium"
                            >
                              Linked: {items.find((i) => i.id === expense.itinerary_item_id)?.title || "Planned Item"}
                            </Badge>
                          )}
                        </div>

                        {/* Cost Split Breakdown Pill */}
                        {expense.splits && expense.splits.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px] text-slate-500">
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 border-emerald-200 bg-emerald-50/50 text-emerald-800 font-medium"
                            >
                              {expense.split_type === "custom" ? "Custom Split" : "Equal Split"} ({expense.splits.length})
                            </Badge>
                            <span className="truncate max-w-md">
                              {expense.splits
                                .map(
                                  (s) =>
                                    `${s.member_name || "Member"}: ${formatCurrency(
                                      Number(s.amount),
                                      expense.currency
                                    )}`
                                )
                                .join(" • ")}
                            </span>
                          </div>
                        )}

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
                          {formatCurrency(Number(expense.amount), expense.currency)}
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
                    From planned sightseeing & tours with price confidence.
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
                    const linkedExpense = expenses.find((e) => e.itinerary_item_id === item.id);

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 hover:bg-slate-50/70 transition-colors text-xs"
                      >
                        <div className="min-w-0 pr-2 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-800 truncate block">
                              {item.title}
                            </span>
                            <PriceConfidenceBadge item={item} compact />
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>
                              Day {item.day_number || 1} • {item.category}
                            </span>
                            {linkedExpense && (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] py-0 font-medium"
                              >
                                Receipt: {formatCurrency(Number(linkedExpense.amount), linkedExpense.currency)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {hasCost ? (
                            Number(cost) === 0 ? (
                              <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                                Free
                              </Badge>
                            ) : (
                              <span
                                className={`font-bold ${
                                  linkedExpense ? "line-through text-slate-400" : "text-slate-900"
                                }`}
                              >
                                {formatCurrency(Number(cost), item.currency)}
                              </span>
                            )
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-500 border-slate-200">
                              Unpriced
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

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Amount *
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
                    Currency *
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={expenseCurrency}
                    onChange={(e) => setExpenseCurrency(e.target.value.toUpperCase())}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs uppercase font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    placeholder="USD"
                    required
                  />
                </div>
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

              {/* Paid By Selector */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Paid By (Trip Member)
                </label>
                <select
                  value={paidByMemberId}
                  onChange={(e) => setPaidByMemberId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">-- Personal / Unassigned Payer --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name} {m.role === "owner" ? "(Organizer)" : "(Companion)"}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Assign who originally paid this expense to track balances and reimbursements.
                </p>
              </div>

              {/* Expense Splitting Selector */}
              {members.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="font-semibold text-slate-700 block text-xs">
                    Expense Splitting Mode
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSplitMode("none")}
                      className={`py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                        splitMode === "none"
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      No Split (Solo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode("equal")}
                      className={`py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                        splitMode === "equal"
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Equal Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode("custom")}
                      className={`py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                        splitMode === "custom"
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Custom Split
                    </button>
                  </div>

                  {/* Equal Split Participant Selection & Live Preview */}
                  {splitMode === "equal" && (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 text-[11px]">
                          Select Participants ({equalParticipantIds.length} of {members.length})
                        </span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setEqualParticipantIds(members.map((m) => m.id))}
                            className="text-emerald-700 font-medium hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setEqualParticipantIds([])}
                            className="text-slate-500 font-medium hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {members.map((m) => {
                          const isChecked = equalParticipantIds.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className={`flex items-center gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-white border-emerald-300 text-slate-900 shadow-2xs"
                                  : "bg-slate-50/70 border-slate-200 text-slate-500"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEqualParticipantIds((prev) => [...prev, m.id]);
                                  } else {
                                    setEqualParticipantIds((prev) =>
                                      prev.filter((id) => id !== m.id)
                                    );
                                  }
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                              />
                              <span className="truncate font-medium">{m.display_name}</span>
                            </label>
                          );
                        })}
                      </div>

                      {equalSplitPreview ? (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900 space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span>Exact Equal Shares Preview:</span>
                            <span>Total: {formatCurrency(equalSplitPreview.totalAmount, expenseCurrency)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {equalSplitPreview.shares.map((s) => {
                              const member = members.find((m) => m.id === s.memberId);
                              return (
                                <span
                                  key={s.memberId}
                                  className="bg-white border border-emerald-300 px-1.5 py-0.5 rounded text-emerald-800 font-medium"
                                >
                                  {member?.display_name || "Member"}: {formatCurrency(s.amount, expenseCurrency)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">
                          Enter an expense amount above and select participants to preview split shares.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Custom Split Inputs & Balance Indicator */}
                  {splitMode === "custom" && (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-800">
                          Custom Share per Member
                        </span>
                        <span className="font-bold text-slate-600">
                          Total Expense: {formatCurrency(fromCents(targetExpenseCents), expenseCurrency)}
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 p-1.5 bg-white border border-slate-200 rounded-md"
                          >
                            <span className="truncate font-medium text-slate-800 flex-1">
                              {m.display_name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-slate-400 text-[10px] font-mono">
                                {getCurrencySymbol(expenseCurrency || primaryCurrency)}
                              </span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0.00"
                                value={customShares[m.id] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCustomShares((prev) => ({
                                    ...prev,
                                    [m.id]: val,
                                  }));
                                }}
                                className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div
                        className={`rounded-md p-2 text-[11px] border font-medium ${
                          customDiscrepancyCents === 0 && targetExpenseCents > 0
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : customDiscrepancyCents > 0
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>Allocated: {formatCurrency(fromCents(customAllocatedCents), expenseCurrency)}</span>
                          <span>
                            {customDiscrepancyCents === 0 && targetExpenseCents > 0
                              ? "✓ Matches Exactly"
                              : customDiscrepancyCents > 0
                              ? `Remaining: ${formatCurrency(fromCents(customDiscrepancyCents), expenseCurrency)}`
                              : `Over-allocated by: ${formatCurrency(fromCents(Math.abs(customDiscrepancyCents)), expenseCurrency)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  Link to Planned Itinerary Item (Optional)
                </label>
                <select
                  value={expenseItineraryItemId}
                  onChange={(e) => setExpenseItineraryItemId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">-- No linked itinerary item (Standalone) --</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} {item.estimated_cost ? `(~${formatCurrency(Number(item.estimated_cost), item.currency)})` : "(Unpriced)"}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Linking this expense marks the planned estimate as realized, preventing double-counting.
                </p>
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
                  disabled={
                    isSubmittingExpense ||
                    (splitMode === "custom" &&
                      (customDiscrepancyCents !== 0 || targetExpenseCents <= 0)) ||
                    (splitMode === "equal" && equalParticipantIds.length === 0)
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  {isSubmittingExpense ? "Recording..." : "Record Expense"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 30% Cost Saving Review Modal */}
      <CostSavingModal
        isOpen={isCostSavingModalOpen}
        onClose={() => setIsCostSavingModalOpen(false)}
        trip={trip}
        items={items}
        onSuccess={(updatedItems) => {
          setItems(updatedItems);
        }}
      />
    </div>
  );
}

