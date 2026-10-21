/**
 * Trip Health Score Engine
 * Pure, deterministic calculation of itinerary quality and schedule feasibility.
 *
 * Evaluates 5 balanced categories (0–100 total points):
 * 1. Budget Fit (Max 20 pts)
 * 2. Schedule Conflicts (Max 25 pts)
 * 3. Daily Workload (Max 20 pts)
 * 4. Rest Time (Max 20 pts)
 * 5. Travel Feasibility (Max 15 pts)
 */

export type HealthGrade = "Excellent" | "Good" | "Needs Attention" | "Critical Issues";

export type IssueSeverity = "critical" | "warning" | "info";

export type HealthCategory =
  | "budgetFit"
  | "scheduleConflicts"
  | "dailyWorkload"
  | "restTime"
  | "travelFeasibility";

export interface CategoryBreakdown {
  score: number;
  maxScore: number;
  status: "excellent" | "good" | "warning" | "critical";
  summary: string;
}

export interface HealthIssue {
  id: string;
  category: HealthCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  dayNumber?: number;
  itemIds?: string[];
}

export interface HealthSuggestion {
  id: string;
  category: HealthCategory;
  action: string;
  recommendedTool?: "optimizer" | "budget" | "builder" | "calendar";
}

export interface TripHealthResult {
  score: number; // 0–100 integer
  grade: HealthGrade;
  breakdown: {
    budgetFit: CategoryBreakdown;
    scheduleConflicts: CategoryBreakdown;
    dailyWorkload: CategoryBreakdown;
    restTime: CategoryBreakdown;
    travelFeasibility: CategoryBreakdown;
  };
  issues: HealthIssue[];
  suggestions: HealthSuggestion[];
  dataLimitations: string[];
}

export interface TripHealthItem {
  id: string;
  day_number?: number | null;
  title: string;
  start_time?: string | null;
  end_time?: string | null;
  estimated_cost?: number | string | null;
  currency?: string | null;
  category?: string | null;
  trip_stop_id?: string | null;
}

export interface TripHealthStop {
  id: string;
  custom_city_name?: string | null;
  order_index?: number | null;
  arrival_date?: string | null;
  departure_date?: string | null;
  cities?: {
    name?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
}

export interface TripHealthExpense {
  id: string;
  amount: number | string;
  currency?: string | null;
  itinerary_item_id?: string | null;
}

export interface TripHealthInput {
  trip: {
    id?: string;
    total_budget?: number | string | null;
    currency?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  };
  items?: TripHealthItem[];
  stops?: TripHealthStop[];
  expenses?: TripHealthExpense[];
}

/**
 * Validates a time string and converts it to minutes from midnight (0–1439).
 * Accepts "HH:MM", "HH:MM:SS", "H:MM". Returns null if missing or invalid.
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Computes great-circle distance between two geographic coordinates using Haversine formula.
 * Earth radius = 6,371 km.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

/**
 * Main Deterministic Trip Health Scoring Function
 */
export function computeTripHealth(input: TripHealthInput): TripHealthResult {
  const trip = input.trip || {};
  const items = Array.isArray(input.items) ? input.items : [];
  const stops = Array.isArray(input.stops) ? input.stops : [];
  const expenses = Array.isArray(input.expenses) ? input.expenses : [];

  const issues: HealthIssue[] = [];
  const suggestions: HealthSuggestion[] = [];
  const dataLimitations: string[] = [];

  const primaryCurrency = (trip.currency || "USD").trim().toUpperCase();

  // ---------------------------------------------------------------------------
  // 1. Budget Fit (Max 20 pts)
  // ---------------------------------------------------------------------------
  let budgetScore = 20;
  let budgetStatus: CategoryBreakdown["status"] = "excellent";
  let budgetSummary = "";

  const rawBudget = trip.total_budget;
  const hasBudgetSet =
    rawBudget !== null &&
    rawBudget !== undefined &&
    !isNaN(Number(rawBudget)) &&
    Number(rawBudget) > 0;
  const budgetAmount = hasBudgetSet ? Number(rawBudget) : 0;

  // Track unknown/missing prices and secondary currencies
  let unknownPricesCount = 0;
  const otherCurrenciesMap: Record<string, number> = {};

  // Track item IDs that have linked expenses in the primary currency to avoid double-counting
  const linkedItemIds = new Set<string>();
  let primaryExpensesTotal = 0;

  expenses.forEach((exp) => {
    const expCur = (exp.currency || primaryCurrency).trim().toUpperCase();
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) return;

    if (expCur === primaryCurrency) {
      primaryExpensesTotal += amount;
      if (exp.itinerary_item_id) {
        linkedItemIds.add(exp.itinerary_item_id);
      }
    } else {
      otherCurrenciesMap[expCur] = (otherCurrenciesMap[expCur] || 0) + amount;
    }
  });

  // Calculate planned activities cost in primary currency (avoiding double-counting linked items)
  let primaryActivitiesPlanned = 0;

  items.forEach((item) => {
    const rawCost = item.estimated_cost;
    if (rawCost === null || rawCost === undefined || rawCost === "" || isNaN(Number(rawCost))) {
      unknownPricesCount++;
      return;
    }

    const costNum = Number(rawCost);
    if (costNum < 0) {
      unknownPricesCount++;
      return;
    }

    const itemCur = (item.currency || primaryCurrency).trim().toUpperCase();
    if (itemCur === primaryCurrency) {
      // If this item already has a linked actual expense, do not double-count its estimate
      if (!linkedItemIds.has(item.id)) {
        primaryActivitiesPlanned += costNum;
      }
    } else {
      otherCurrenciesMap[itemCur] = (otherCurrenciesMap[itemCur] || 0) + costNum;
    }
  });

  const totalPrimaryCost = primaryExpensesTotal + primaryActivitiesPlanned;

  if (unknownPricesCount > 0) {
    dataLimitations.push(
      `${unknownPricesCount} ${unknownPricesCount === 1 ? "activity has" : "activities have"} unknown or unpriced costs; spending totals may be higher.`
    );
    if (hasBudgetSet) {
      issues.push({
        id: "budget-unpriced-items",
        category: "budgetFit",
        severity: "info",
        title: "Unpriced Activities",
        description: `${unknownPricesCount} activities do not have estimated costs specified.`,
      });
    }
  }

  const secondaryCurrencies = Object.entries(otherCurrenciesMap);
  if (secondaryCurrencies.length > 0) {
    const secondaryStr = secondaryCurrencies
      .map(([c, amt]) => `${c} ${amt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
      .join(", ");
    dataLimitations.push(
      `Costs in secondary currencies (${secondaryStr}) are tracked separately and not merged into the primary ${primaryCurrency} budget.`
    );
  }

  if (!hasBudgetSet) {
    budgetScore = 20;
    budgetStatus = "good";
    budgetSummary = `No positive budget limit set. Total planned spending in ${primaryCurrency} is ${totalPrimaryCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`;
    dataLimitations.push("No positive total budget cap is set for this trip. Full budget score awarded.");
    if (totalPrimaryCost > 0) {
      suggestions.push({
        id: "suggest-set-budget",
        category: "budgetFit",
        action: `You have planned ${primaryCurrency} ${totalPrimaryCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} in spending. Setting a budget helps monitor spending targets.`,
        recommendedTool: "budget",
      });
    }
  } else {
    if (totalPrimaryCost <= budgetAmount) {
      budgetScore = 20;
      budgetStatus = "excellent";
      const remaining = budgetAmount - totalPrimaryCost;
      budgetSummary = `Planned spending (${primaryCurrency} ${totalPrimaryCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}) fits comfortably within your ${primaryCurrency} ${budgetAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} budget (${primaryCurrency} ${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} buffer remaining).`;
    } else {
      const overspend = totalPrimaryCost - budgetAmount;
      const overspendRatio = overspend / budgetAmount;

      if (overspendRatio <= 0.1) {
        budgetScore = 15;
        budgetStatus = "warning";
        budgetSummary = `Planned costs exceed budget slightly by ${primaryCurrency} ${overspend.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${Math.round(overspendRatio * 100)}% over).`;
        issues.push({
          id: "budget-slight-overrun",
          category: "budgetFit",
          severity: "warning",
          title: "Slight Budget Overrun",
          description: `Planned costs exceed budget by ${primaryCurrency} ${overspend.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${Math.round(overspendRatio * 100)}%).`,
        });
        suggestions.push({
          id: "suggest-budget-trim-slight",
          category: "budgetFit",
          action: "Review planned activity expenses or slightly adjust your trip budget.",
          recommendedTool: "budget",
        });
      } else if (overspendRatio <= 0.25) {
        budgetScore = 10;
        budgetStatus = "warning";
        budgetSummary = `Planned costs exceed budget by ${primaryCurrency} ${overspend.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${Math.round(overspendRatio * 100)}% over).`;
        issues.push({
          id: "budget-moderate-overrun",
          category: "budgetFit",
          severity: "warning",
          title: "Budget Exceeded",
          description: `Planned spending exceeds your budget by ${primaryCurrency} ${overspend.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${Math.round(overspendRatio * 100)}%).`,
        });
        suggestions.push({
          id: "suggest-budget-trim-moderate",
          category: "budgetFit",
          action: "Consider substituting high-cost items with free attractions or walking tours.",
          recommendedTool: "budget",
        });
      } else {
        budgetScore = 0;
        budgetStatus = "critical";
        budgetSummary = `Severe budget overrun: Planned costs exceed budget by ${primaryCurrency} ${overspend.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${Math.round(overspendRatio * 100)}% over).`;
        issues.push({
          id: "budget-severe-overrun",
          category: "budgetFit",
          severity: "critical",
          title: "Critical Budget Deficit",
          description: `Planned spending (${primaryCurrency} ${totalPrimaryCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}) severely exceeds budget (${primaryCurrency} ${budgetAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`,
        });
        suggestions.push({
          id: "suggest-budget-trim-severe",
          category: "budgetFit",
          action: "Re-evaluate high-ticket activities or increase your trip budget before travel.",
          recommendedTool: "optimizer",
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Schedule Conflicts (Max 25 pts)
  // ---------------------------------------------------------------------------
  let conflictsScore = 25;
  let conflictsStatus: CategoryBreakdown["status"] = "excellent";
  let conflictsSummary = "";

  // Group items by day_number
  const itemsByDay: Record<number, TripHealthItem[]> = {};
  items.forEach((item) => {
    const d = item.day_number || 1;
    if (!itemsByDay[d]) itemsByDay[d] = [];
    itemsByDay[d].push(item);
  });

  let detectedConflictsCount = 0;

  Object.entries(itemsByDay).forEach(([dayStr, dayItems]) => {
    const dayNum = Number(dayStr);

    // Filter items with valid parsed time intervals
    const timedItems = dayItems
      .map((item) => {
        const start = parseTimeToMinutes(item.start_time);
        const end = parseTimeToMinutes(item.end_time);
        return { item, start, end };
      })
      .filter((t): t is { item: TripHealthItem; start: number; end: number } => {
        return t.start !== null && t.end !== null;
      });

    // Check for invalid windows where start >= end
    timedItems.forEach(({ item, start, end }) => {
      if (start >= end) {
        issues.push({
          id: `invalid-time-window-${item.id}`,
          category: "scheduleConflicts",
          severity: "warning",
          title: `Invalid Time Window: "${item.title}"`,
          description: `Start time (${item.start_time}) is not before end time (${item.end_time}) on Day ${dayNum}.`,
          dayNumber: dayNum,
          itemIds: [item.id],
        });
      }
    });

    // Only compare items with valid start < end windows
    const validTimedItems = timedItems.filter((t) => t.start < t.end);

    // Pairwise interval check avoiding duplicate pairs (i < j)
    for (let i = 0; i < validTimedItems.length; i++) {
      for (let j = i + 1; j < validTimedItems.length; j++) {
        const a = validTimedItems[i];
        const b = validTimedItems[j];

        // Genuine overlap check: A.start < B.end AND B.start < A.end
        // (If A.end === B.start, they touch back-to-back, which is not an overlap)
        if (a.start < b.end && b.start < a.end) {
          detectedConflictsCount++;
          const aTime = `${a.item.start_time?.slice(0, 5)}–${a.item.end_time?.slice(0, 5)}`;
          const bTime = `${b.item.start_time?.slice(0, 5)}–${b.item.end_time?.slice(0, 5)}`;

          issues.push({
            id: `conflict-${a.item.id}-${b.item.id}`,
            category: "scheduleConflicts",
            severity: "critical",
            title: `Schedule Conflict on Day ${dayNum}`,
            description: `"${a.item.title}" (${aTime}) overlaps with "${b.item.title}" (${bTime}).`,
            dayNumber: dayNum,
            itemIds: [a.item.id, b.item.id],
          });
        }
      }
    }
  });

  if (detectedConflictsCount === 0) {
    conflictsScore = 25;
    conflictsStatus = "excellent";
    conflictsSummary = "No overlapping time conflicts detected.";
  } else {
    // 10 points deducted per conflict pair, capped at 0
    conflictsScore = Math.max(0, 25 - detectedConflictsCount * 10);
    conflictsStatus = conflictsScore >= 15 ? "warning" : "critical";
    conflictsSummary = `${detectedConflictsCount} overlapping schedule ${detectedConflictsCount === 1 ? "conflict" : "conflicts"} detected.`;
    suggestions.push({
      id: "suggest-resolve-conflicts",
      category: "scheduleConflicts",
      action: "Use the AI Optimizer or adjust start/end times in the Calendar to eliminate overlapping activities.",
      recommendedTool: "optimizer",
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Daily Workload (Max 20 pts)
  // ---------------------------------------------------------------------------
  let workloadScore = 20;
  let workloadStatus: CategoryBreakdown["status"] = "excellent";
  let workloadSummary = "";

  // Determine active planned trip duration in days
  let tripDurationDays = 1;
  const startDateObj = trip.start_date ? new Date(trip.start_date) : null;
  const endDateObj = trip.end_date ? new Date(trip.end_date) : null;

  if (
    startDateObj &&
    endDateObj &&
    !isNaN(startDateObj.getTime()) &&
    !isNaN(endDateObj.getTime()) &&
    endDateObj >= startDateObj
  ) {
    const diffMs = endDateObj.getTime() - startDateObj.getTime();
    tripDurationDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
  }

  // Max planned day across items
  const maxItemDay = items.reduce((max, item) => Math.max(max, item.day_number || 1), 1);
  const evalDays = Math.max(tripDurationDays, maxItemDay);

  if (items.length === 0) {
    // Empty trip
    workloadScore = 15;
    workloadStatus = "good";
    workloadSummary = "No activities scheduled yet.";
    suggestions.push({
      id: "suggest-add-activities",
      category: "dailyWorkload",
      action: "Add activities or use AI Smart Suggest to build your daily itinerary.",
      recommendedTool: "builder",
    });
  } else {
    let workloadDeductions = 0;
    let overloadedDaysCount = 0;
    let busyDaysCount = 0;
    let emptyDaysCount = 0;

    for (let d = 1; d <= evalDays; d++) {
      const count = (itemsByDay[d] || []).length;

      if (count >= 6) {
        // Overloaded day: -5 pts per day
        overloadedDaysCount++;
        workloadDeductions += 5;
        issues.push({
          id: `workload-overload-day-${d}`,
          category: "dailyWorkload",
          severity: "warning",
          title: `Day ${d} is Overloaded`,
          description: `Day ${d} has ${count} planned activities. Pacing will likely feel exhausting with little downtime.`,
          dayNumber: d,
        });
        suggestions.push({
          id: `suggest-spread-day-${d}`,
          category: "dailyWorkload",
          action: `Move some activities from Day ${d} to other days with lighter schedules.`,
          recommendedTool: "builder",
        });
      } else if (count === 5) {
        // Moderately busy: -2 pts per day
        busyDaysCount++;
        workloadDeductions += 2;
        issues.push({
          id: `workload-busy-day-${d}`,
          category: "dailyWorkload",
          severity: "info",
          title: `Day ${d} is Moderately Busy`,
          description: `Day ${d} has 5 activities scheduled. Consider keeping evening plans flexible.`,
          dayNumber: d,
        });
      } else if (count === 0 && d <= tripDurationDays) {
        // Empty day within trip dates: informational, minor deduction (-1 pt, capped at 3 pts total)
        emptyDaysCount++;
        if (workloadDeductions < 3) {
          workloadDeductions += 1;
        }
        issues.push({
          id: `workload-empty-day-${d}`,
          category: "dailyWorkload",
          severity: "info",
          title: `Day ${d} Has No Activities`,
          description: `Day ${d} is currently open with no planned activities.`,
          dayNumber: d,
        });
        suggestions.push({
          id: `suggest-plan-day-${d}`,
          category: "dailyWorkload",
          action: `Plan activities for Day ${d} or keep it as an intentional rest/transit day.`,
          recommendedTool: "builder",
        });
      }
    }

    workloadScore = Math.max(0, 20 - workloadDeductions);
    if (workloadScore >= 18) {
      workloadStatus = "excellent";
      workloadSummary = `Balanced pacing across ${evalDays} day(s). Most days feature 1–4 activities.`;
    } else if (workloadScore >= 12) {
      workloadStatus = "good";
      workloadSummary = `Generally manageable pacing, with ${overloadedDaysCount + busyDaysCount} busy day(s).`;
    } else if (workloadScore >= 6) {
      workloadStatus = "warning";
      workloadSummary = `Challenging daily workload: ${overloadedDaysCount} overloaded day(s) with 6+ activities.`;
    } else {
      workloadStatus = "critical";
      workloadSummary = `Excessive daily workload across multiple days.`;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Rest Time & Transition Gaps (Max 20 pts)
  // ---------------------------------------------------------------------------
  let restScore = 20;
  let restStatus: CategoryBreakdown["status"] = "excellent";
  let restSummary = "";

  let rushedTransitionsCount = 0;
  let untimedCount = 0;

  Object.entries(itemsByDay).forEach(([dayStr, dayItems]) => {
    const dayNum = Number(dayStr);

    // Track untimed items
    dayItems.forEach((item) => {
      if (!parseTimeToMinutes(item.start_time) || !parseTimeToMinutes(item.end_time)) {
        untimedCount++;
      }
    });

    // Chronologically sort timed items on this day
    const validTimed = dayItems
      .map((item) => {
        const start = parseTimeToMinutes(item.start_time);
        const end = parseTimeToMinutes(item.end_time);
        return { item, start, end };
      })
      .filter((t): t is { item: TripHealthItem; start: number; end: number } => {
        return t.start !== null && t.end !== null && t.start < t.end;
      })
      .sort((a, b) => a.start - b.start);

    // Calculate transition gaps between consecutive timed activities
    for (let i = 0; i < validTimed.length - 1; i++) {
      const current = validTimed[i];
      const next = validTimed[i + 1];

      // Buffer in minutes between end of current and start of next
      const gapMinutes = next.start - current.end;

      if (gapMinutes >= 0 && gapMinutes < 15) {
        // Rushed transition: < 15 minutes buffer
        rushedTransitionsCount++;
        issues.push({
          id: `rushed-transition-${current.item.id}-${next.item.id}`,
          category: "restTime",
          severity: "warning",
          title: `Rushed Transition on Day ${dayNum}`,
          description: `Only ${gapMinutes} min gap between "${current.item.title}" (${current.item.end_time?.slice(0, 5)}) and "${next.item.title}" (${next.item.start_time?.slice(0, 5)}).`,
          dayNumber: dayNum,
          itemIds: [current.item.id, next.item.id],
        });
      } else if (gapMinutes >= 15 && gapMinutes < 30) {
        // Tight transition: 15–29 minutes buffer (informational warning)
        issues.push({
          id: `tight-transition-${current.item.id}-${next.item.id}`,
          category: "restTime",
          severity: "info",
          title: `Tight Buffer on Day ${dayNum}`,
          description: `${gapMinutes} min buffer between "${current.item.title}" and "${next.item.title}". Allow sufficient time for transit.`,
          dayNumber: dayNum,
          itemIds: [current.item.id, next.item.id],
        });
      }
    }
  });

  // Untimed activities safeguard: do not penalize points, but generate informational tip
  if (untimedCount > 0) {
    dataLimitations.push(
      `${untimedCount} ${untimedCount === 1 ? "activity has" : "activities have"} no specific time slots assigned. Rest gaps cannot be calculated for untimed activities.`
    );
    suggestions.push({
      id: "suggest-schedule-untimed",
      category: "restTime",
      action: "Assign start and end times to your activities in the Calendar to verify transition buffers and travel time.",
      recommendedTool: "calendar",
    });
  }

  // Deduct 5 points per rushed transition, capped at 0
  restScore = Math.max(0, 20 - rushedTransitionsCount * 5);

  if (rushedTransitionsCount === 0) {
    restScore = 20;
    restStatus = "excellent";
    restSummary = "Adequate rest gaps and transition buffers between timed activities.";
  } else {
    restStatus = restScore >= 10 ? "warning" : "critical";
    restSummary = `${rushedTransitionsCount} rushed ${rushedTransitionsCount === 1 ? "transition" : "transitions"} (<15 min buffer) detected.`;
    suggestions.push({
      id: "suggest-add-buffers",
      category: "restTime",
      action: "Add at least a 15–30 minute buffer between consecutive venues for transit and downtime.",
      recommendedTool: "optimizer",
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Travel Feasibility (Max 15 pts)
  // ---------------------------------------------------------------------------
  let travelScore = 15;
  let travelStatus: CategoryBreakdown["status"] = "excellent";
  let travelSummary = "";

  let travelDeductions = 0;

  // Validate stop dates
  const sortedStops = [...stops].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  sortedStops.forEach((stop) => {
    const stopName = stop.custom_city_name || stop.cities?.name || "Destination";
    const arr = stop.arrival_date ? new Date(stop.arrival_date) : null;
    const dep = stop.departure_date ? new Date(stop.departure_date) : null;

    if (arr && dep && !isNaN(arr.getTime()) && !isNaN(dep.getTime())) {
      if (dep < arr) {
        travelDeductions += 5;
        issues.push({
          id: `stop-dates-inverted-${stop.id}`,
          category: "travelFeasibility",
          severity: "critical",
          title: `Inconsistent Dates for ${stopName}`,
          description: `Departure date (${stop.departure_date}) is earlier than arrival date (${stop.arrival_date}).`,
        });
      }
    }
  });

  // Check consecutive stops for overlapping dates or long-distance same-day transit
  for (let i = 0; i < sortedStops.length - 1; i++) {
    const s1 = sortedStops[i];
    const s2 = sortedStops[i + 1];
    const name1 = s1.custom_city_name || s1.cities?.name || `Stop ${i + 1}`;
    const name2 = s2.custom_city_name || s2.cities?.name || `Stop ${i + 2}`;

    // Consecutive stop date ordering
    if (s1.departure_date && s2.arrival_date) {
      const d1 = new Date(s1.departure_date);
      const a2 = new Date(s2.arrival_date);
      if (!isNaN(d1.getTime()) && !isNaN(a2.getTime()) && a2 < d1) {
        travelDeductions += 5;
        issues.push({
          id: `stops-chronology-overlap-${s1.id}-${s2.id}`,
          category: "travelFeasibility",
          severity: "warning",
          title: `Inconsistent Route Sequence`,
          description: `Arrival in ${name2} (${s2.arrival_date}) precedes departure from ${name1} (${s1.departure_date}).`,
        });
      }
    }

    // Geographic distance check: ONLY when reliable coordinates exist for BOTH stops
    const lat1 = Number(s1.cities?.latitude);
    const lon1 = Number(s1.cities?.longitude);
    const lat2 = Number(s2.cities?.latitude);
    const lon2 = Number(s2.cities?.longitude);

    const hasCoords1 = !isNaN(lat1) && !isNaN(lon1) && lat1 !== 0 && lon1 !== 0;
    const hasCoords2 = !isNaN(lat2) && !isNaN(lon2) && lat2 !== 0 && lon2 !== 0;

    if (!hasCoords1) {
      dataLimitations.push(
        `Destination "${name1}" lacks catalog coordinates; inter-city distance checks skipped.`
      );
    }
    if (!hasCoords2 && s2.cities) {
      dataLimitations.push(
        `Destination "${name2}" lacks catalog coordinates; inter-city distance checks skipped.`
      );
    }

    // Long-distance same-day transit check
    if (hasCoords1 && hasCoords2) {
      const distanceKm = haversineDistanceKm(lat1, lon1, lat2, lon2);

      // If distance > 500 km and departure from s1 equals arrival at s2 (same-day transfer)
      if (
        distanceKm > 500 &&
        s1.departure_date &&
        s2.arrival_date &&
        s1.departure_date === s2.arrival_date
      ) {
        // Count activities scheduled on that transfer date
        const transitionDate = s1.departure_date;
        const activitiesOnTransition = items.filter(
          (it) => it.trip_stop_id === s1.id || it.trip_stop_id === s2.id
        ).length;

        if (activitiesOnTransition > 3) {
          travelDeductions += 5;
          issues.push({
            id: `long-distance-same-day-${s1.id}-${s2.id}`,
            category: "travelFeasibility",
            severity: "warning",
            title: "High Transit Friction",
            description: `Long-distance journey (~${Math.round(distanceKm)} km) between ${name1} and ${name2} on ${transitionDate} with ${activitiesOnTransition} scheduled activities leaves little transit buffer.`,
          });
          suggestions.push({
            id: `suggest-transit-buffer-${s1.id}`,
            category: "travelFeasibility",
            action: `Allow a transit buffer day or reduce planned activities on the transfer date (${transitionDate}) between ${name1} and ${name2}.`,
            recommendedTool: "builder",
          });
        }
      }
    }
  }

  travelScore = Math.max(0, 15 - travelDeductions);
  if (travelScore === 15) {
    travelStatus = "excellent";
    travelSummary = "Route dates and transit sequence are logically feasible.";
  } else if (travelScore >= 10) {
    travelStatus = "good";
    travelSummary = "Minor transit friction or date overlap detected in stops.";
  } else {
    travelStatus = "critical";
    travelSummary = "Severe date inconsistency or high transit friction detected in stops.";
  }

  // ---------------------------------------------------------------------------
  // Overall Clamped Score & Grade (0–100)
  // ---------------------------------------------------------------------------
  const rawTotal = budgetScore + conflictsScore + workloadScore + restScore + travelScore;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawTotal)));

  let grade: HealthGrade = "Excellent";
  if (finalScore >= 90) {
    grade = "Excellent";
  } else if (finalScore >= 75) {
    grade = "Good";
  } else if (finalScore >= 55) {
    grade = "Needs Attention";
  } else {
    grade = "Critical Issues";
  }

  // Deduplicate data limitations
  const uniqueLimitations = Array.from(new Set(dataLimitations));

  // Deduplicate suggestions by ID
  const uniqueSuggestions = suggestions.filter(
    (s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx
  );

  return {
    score: finalScore,
    grade,
    breakdown: {
      budgetFit: {
        score: budgetScore,
        maxScore: 20,
        status: budgetStatus,
        summary: budgetSummary,
      },
      scheduleConflicts: {
        score: conflictsScore,
        maxScore: 25,
        status: conflictsStatus,
        summary: conflictsSummary,
      },
      dailyWorkload: {
        score: workloadScore,
        maxScore: 20,
        status: workloadStatus,
        summary: workloadSummary,
      },
      restTime: {
        score: restScore,
        maxScore: 20,
        status: restStatus,
        summary: restSummary,
      },
      travelFeasibility: {
        score: travelScore,
        maxScore: 15,
        status: travelStatus,
        summary: travelSummary,
      },
    },
    issues,
    suggestions: uniqueSuggestions,
    dataLimitations: uniqueLimitations,
  };
}
