/**
 * Real Budget Engine
 * Pure, deterministic calculation of 5-pillar trip budgets, price confidence,
 * currency-isolated totals, and 30% cost-saving proposals.
 *
 * Guarantees 100% mathematical consistency with lib/scoring/tripHealth.ts:
 * - Never combines un-converted currencies
 * - Replaces planned item estimates with linked actual expenses to prevent double-counting
 * - Discloses unpriced items rather than assuming zero cost
 */

export type BudgetPillarKey =
  | "accommodation"
  | "transport"
  | "food"
  | "activities"
  | "other";

export type PriceConfidenceType =
  | "catalog"
  | "ai_estimate"
  | "user_entered"
  | "unpriced";

export interface PillarBreakdown {
  key: BudgetPillarKey;
  label: string;
  plannedCost: number;       // in primary currency, total planned items in this pillar
  unlinkedPlannedCost: number; // in primary currency, unlinked items in this pillar
  actualCost: number;        // in primary currency, all logged expenses in this pillar
  totalCommitted: number;    // actualCost + unlinkedPlannedCost (with linked items replaced)
  unpricedCount: number;
  itemCount: number;
  expenseCount: number;
}

export interface PriceConfidenceInfo {
  type: PriceConfidenceType;
  label: string;
  description: string;
  confidenceGrade: "High" | "Approximate" | "User Supplied" | "Unknown";
}

export interface CostSavingProposal {
  id: string;
  itemId: string;
  currentTitle: string;
  currentCost: number;
  currentCategory: string;
  dayNumber: number;
  proposedTitle: string;
  proposedCost: number;
  estimatedSavings: number;
  tradeOff: string;
  confidence: PriceConfidenceType;
  requiresVerification: boolean;
  selectedByDefault: boolean;
}

export interface CostSavingPlan {
  currentPlannedCost: number;
  targetPlannedCost: number;
  targetSavings: number;     // 30% of eligible planned cost
  projectedSavings: number;  // sum of selected proposals
  achievedPercentage: number;
  proposals: CostSavingProposal[];
  isEligible: boolean;
  ineligibilityReason?: string;
  summary?: string;
}

export interface BudgetEngineItem {
  id: string;
  day_number?: number | null;
  title: string;
  category?: string | null;
  estimated_cost?: number | string | null;
  currency?: string | null;
  activity_id?: string | null;
  activities?: any | null;
  notes?: string | null;
}

export interface BudgetEngineExpense {
  id: string;
  amount: number | string;
  currency?: string | null;
  category: string;
  title: string;
  itinerary_item_id?: string | null;
  expense_date?: string | null;
}

export interface BudgetEngineTrip {
  id?: string;
  total_budget?: number | string | null;
  currency?: string | null;
}

export interface BudgetEngineInput {
  trip: BudgetEngineTrip;
  items: BudgetEngineItem[];
  expenses: BudgetEngineExpense[];
}

export interface BudgetBreakdownResult {
  primaryCurrency: string;
  targetBudget: number;
  hasBudgetSet: boolean;
  pillars: Record<BudgetPillarKey, PillarBreakdown>;
  totalPlanned: number;       // sum of ALL planned items in primary currency
  unlinkedPlanned: number;    // sum of unlinked planned items in primary currency
  totalActuals: number;       // sum of expenses in primary currency
  totalCommitted: number;     // totalActuals + unlinkedPlanned (matches tripHealth totalPrimaryCost)
  remainingBudget: number;    // targetBudget - totalCommitted (if targetBudget > 0)
  variance: number;           // targetBudget - totalCommitted (same as remainingBudget)
  budgetUtilization: number;  // (totalCommitted / targetBudget) * 100
  unknownPriceCount: number;
  otherCurrenciesTotals: Record<string, number>;
  otherCurrenciesFormatted: string[];
  otherCurrencies: Array<{ currency: string; totalAmount: number }>;
  isOverBudget: boolean;
  overspendAmount: number;
}

/**
 * Normalizes any category string into one of the 5 core travel budget pillars.
 */
export function normalizeToPillar(category?: string | null): BudgetPillarKey {
  if (!category || typeof category !== "string") return "other";
  const cat = category.trim().toLowerCase();

  // 1. Accommodation
  if (/accommodat|hotel|hostel|resort|lodging|airbnb|stay|motel/i.test(cat)) {
    return "accommodation";
  }

  // 2. Transport
  if (
    /transport|transit|flight|airline|train|rail|bus|ferry|metro|subway|taxi|cab|car\s*rental|rental\s*car|drive|fuel|gas|transfer|rideshare|uber|lyft/i.test(
      cat
    )
  ) {
    return "transport";
  }

  // 3. Food
  if (
    /food|dining|restaurant|meal|breakfast|lunch|dinner|cafe|bistro|street food|bar|cocktail|drink|pub|snack|bakery/i.test(
      cat
    )
  ) {
    return "food";
  }

  // 4. Activities (Sightseeing, Culture, Adventure, Nature, Entertainment, Relaxation)
  if (
    /sightseeing|activity|activities|culture|history|adventure|nature|entertainment|relaxation|tour|museum|park|attraction|monument|excursion|landmark|walk/i.test(
      cat
    )
  ) {
    return "activities";
  }

  // 5. Other Expenses (Shopping, Miscellaneous, Tips, Insurance, Visas, etc.)
  if (/shopping|miscellaneous|misc|other|souvenir|tip|insurance|visa|sim card|gear/i.test(cat)) {
    return "other";
  }

  // Safe fallback for unmapped categories
  return "other";
}

/**
 * Returns human-readable label for a pillar key.
 */
export function getPillarLabel(pillar: BudgetPillarKey): string {
  switch (pillar) {
    case "accommodation":
      return "Accommodation";
    case "transport":
      return "Transport";
    case "food":
      return "Food & Dining";
    case "activities":
      return "Activities & Sightseeing";
    case "other":
    default:
      return "Other Expenses";
  }
}

/**
 * Classifies an itinerary item's price confidence based on available database provenance.
 */
export function getPriceConfidence(item: {
  id?: string;
  activity_id?: string | null;
  activities?: any | null;
  estimated_cost?: number | string | null;
  notes?: string | null;
}): PriceConfidenceInfo {
  const rawCost = item.estimated_cost;
  const isUnpriced =
    rawCost === null ||
    rawCost === undefined ||
    rawCost === "" ||
    isNaN(Number(rawCost)) ||
    Number(rawCost) < 0;

  if (isUnpriced) {
    return {
      type: "unpriced",
      label: "Unpriced",
      description: "No estimated cost specified for this activity.",
      confidenceGrade: "Unknown",
    };
  }

  // 1. Catalog Price: linked to verified catalog record
  if (item.activity_id || item.activities) {
    return {
      type: "catalog",
      label: "Catalog Price",
      description: "Verified curated catalog price from destination database.",
      confidenceGrade: "High",
    };
  }

  // 2. AI Estimate: generated by Gemini AI
  const notesStr = String(item.notes || "");
  const isAIGenerated =
    /ai suggestion|ai smart suggest|ai copilot|gemini/i.test(notesStr);

  if (isAIGenerated) {
    return {
      type: "ai_estimate",
      label: "AI Estimate",
      description: "Approximate AI estimate generated by Gemini. Not a verified live booking rate.",
      confidenceGrade: "Approximate",
    };
  }

  // 3. User Entered: manually input by user
  return {
    type: "user_entered",
    label: "User Entered",
    description: "Price manually provided by user.",
    confidenceGrade: "User Supplied",
  };
}

/**
 * Computes the complete 5-pillar budget breakdown.
 */
export function computeRealBudgetBreakdown(input: BudgetEngineInput): BudgetBreakdownResult {
  const trip = input.trip || {};
  const items = Array.isArray(input.items) ? input.items : [];
  const expenses = Array.isArray(input.expenses) ? input.expenses : [];

  const primaryCurrency = (trip.currency || "USD").trim().toUpperCase();
  const rawBudget = Number(trip.total_budget);
  const hasBudgetSet = !isNaN(rawBudget) && rawBudget > 0;
  const targetBudget = hasBudgetSet ? rawBudget : 0;

  // Initialize the 5 pillars
  const pillars: Record<BudgetPillarKey, PillarBreakdown> = {
    accommodation: {
      key: "accommodation",
      label: "Accommodation",
      plannedCost: 0,
      unlinkedPlannedCost: 0,
      actualCost: 0,
      totalCommitted: 0,
      unpricedCount: 0,
      itemCount: 0,
      expenseCount: 0,
    },
    transport: {
      key: "transport",
      label: "Transport",
      plannedCost: 0,
      unlinkedPlannedCost: 0,
      actualCost: 0,
      totalCommitted: 0,
      unpricedCount: 0,
      itemCount: 0,
      expenseCount: 0,
    },
    food: {
      key: "food",
      label: "Food & Dining",
      plannedCost: 0,
      unlinkedPlannedCost: 0,
      actualCost: 0,
      totalCommitted: 0,
      unpricedCount: 0,
      itemCount: 0,
      expenseCount: 0,
    },
    activities: {
      key: "activities",
      label: "Activities & Sightseeing",
      plannedCost: 0,
      unlinkedPlannedCost: 0,
      actualCost: 0,
      totalCommitted: 0,
      unpricedCount: 0,
      itemCount: 0,
      expenseCount: 0,
    },
    other: {
      key: "other",
      label: "Other Expenses",
      plannedCost: 0,
      unlinkedPlannedCost: 0,
      actualCost: 0,
      totalCommitted: 0,
      unpricedCount: 0,
      itemCount: 0,
      expenseCount: 0,
    },
  };

  const otherCurrenciesTotals: Record<string, number> = {};
  let totalUnknownPrices = 0;

  // Step 1: Process actual logged expenses
  // Track which itinerary items have a linked expense in primary currency to avoid double-counting
  const linkedItemIds = new Set<string>();

  expenses.forEach((exp) => {
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) return;

    const expCur = (exp.currency || primaryCurrency).trim().toUpperCase();
    if (expCur === primaryCurrency) {
      const pillar = normalizeToPillar(exp.category);
      pillars[pillar].actualCost += amount;
      pillars[pillar].expenseCount += 1;

      if (exp.itinerary_item_id) {
        linkedItemIds.add(exp.itinerary_item_id);
      }
    } else {
      otherCurrenciesTotals[expCur] = (otherCurrenciesTotals[expCur] || 0) + amount;
    }
  });

  // Step 2: Process itinerary items (planned costs)
  items.forEach((item) => {
    const pillar = normalizeToPillar(item.category);
    pillars[pillar].itemCount += 1;

    const rawCost = item.estimated_cost;
    const isUnpriced =
      rawCost === null ||
      rawCost === undefined ||
      rawCost === "" ||
      isNaN(Number(rawCost)) ||
      Number(rawCost) < 0;

    if (isUnpriced) {
      pillars[pillar].unpricedCount += 1;
      totalUnknownPrices += 1;
      return;
    }

    const costNum = Number(rawCost);
    if (costNum === 0) {
      // Free item (known cost 0)
      return;
    }

    const itemCur = (item.currency || primaryCurrency).trim().toUpperCase();
    if (itemCur === primaryCurrency) {
      // Total planned costs across all planned items
      pillars[pillar].plannedCost += costNum;

      // Double-counting safeguard: if this item has a linked actual expense,
      // its estimate is replaced by the actual expense and omitted from unlinked planned cost.
      if (!linkedItemIds.has(item.id)) {
        pillars[pillar].unlinkedPlannedCost += costNum;
      }
    } else {
      otherCurrenciesTotals[itemCur] = (otherCurrenciesTotals[itemCur] || 0) + costNum;
    }
  });

  // Step 3: Compute committed cost per pillar and totals
  let totalPlanned = 0;
  let unlinkedPlanned = 0;
  let totalActuals = 0;

  (Object.keys(pillars) as BudgetPillarKey[]).forEach((p) => {
    pillars[p].plannedCost = Math.round(pillars[p].plannedCost * 100) / 100;
    pillars[p].unlinkedPlannedCost = Math.round(pillars[p].unlinkedPlannedCost * 100) / 100;
    pillars[p].actualCost = Math.round(pillars[p].actualCost * 100) / 100;
    pillars[p].totalCommitted = Math.round((pillars[p].actualCost + pillars[p].unlinkedPlannedCost) * 100) / 100;

    totalPlanned += pillars[p].plannedCost;
    unlinkedPlanned += pillars[p].unlinkedPlannedCost;
    totalActuals += pillars[p].actualCost;
  });

  totalPlanned = Math.round(totalPlanned * 100) / 100;
  unlinkedPlanned = Math.round(unlinkedPlanned * 100) / 100;
  totalActuals = Math.round(totalActuals * 100) / 100;
  const totalCommitted = Math.round((unlinkedPlanned + totalActuals) * 100) / 100;

  const remainingBudget = hasBudgetSet
    ? Math.round((targetBudget - totalCommitted) * 100) / 100
    : 0;

  const budgetUtilization = hasBudgetSet && targetBudget > 0
    ? (totalCommitted / targetBudget) * 100
    : 0;

  const isOverBudget = hasBudgetSet && totalCommitted > targetBudget;
  const overspendAmount = isOverBudget ? Math.round((totalCommitted - targetBudget) * 100) / 100 : 0;

  const otherCurrenciesFormatted = Object.entries(otherCurrenciesTotals).map(
    ([c, amt]) => `${c} ${amt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  );

  const otherCurrencies = Object.entries(otherCurrenciesTotals).map(([currency, totalAmount]) => ({
    currency,
    totalAmount,
  }));

  return {
    primaryCurrency,
    targetBudget,
    hasBudgetSet,
    pillars,
    totalPlanned,
    unlinkedPlanned,
    totalActuals,
    totalCommitted,
    remainingBudget,
    variance: remainingBudget,
    budgetUtilization,
    unknownPriceCount: totalUnknownPrices,
    otherCurrenciesTotals,
    otherCurrenciesFormatted,
    otherCurrencies,
    isOverBudget,
    overspendAmount,
  };
}

/**
 * Generates a "Make This Trip 30% Cheaper" proposal plan.
 * Targets a 30% reduction from current eligible planned activities.
 */
export function generateCostSavingPlan(input: {
  trip: BudgetEngineTrip;
  items: BudgetEngineItem[];
  targetReductionRatio?: number; // default 0.30 (30%)
}): CostSavingPlan {
  const ratio = input.targetReductionRatio ?? 0.3;
  const primaryCurrency = (input.trip.currency || "USD").trim().toUpperCase();

  // Filter items that have a positive planned cost in primary currency
  const eligibleItems = (input.items || []).filter((item) => {
    const itemCur = (item.currency || primaryCurrency).trim().toUpperCase();
    const cost = Number(item.estimated_cost);
    return itemCur === primaryCurrency && !isNaN(cost) && cost > 0;
  });

  const currentPlannedCost = eligibleItems.reduce(
    (sum, it) => sum + (Number(it.estimated_cost) || 0),
    0
  );

  if (currentPlannedCost <= 0 || eligibleItems.length === 0) {
    return {
      currentPlannedCost: 0,
      targetPlannedCost: 0,
      targetSavings: 0,
      projectedSavings: 0,
      achievedPercentage: 0,
      proposals: [],
      isEligible: false,
      ineligibilityReason:
        "No paid activities in primary currency found. Your itinerary is already free or has no estimated costs.",
      summary: "No eligible planned items found in primary currency to reduce costs.",
    };
  }

  const targetSavings = Math.round(currentPlannedCost * ratio * 100) / 100;
  const targetPlannedCost = Math.round((currentPlannedCost - targetSavings) * 100) / 100;

  // Sort eligible items by cost descending to prioritize high-cost activities
  const sorted = [...eligibleItems].sort(
    (a, b) => (Number(b.estimated_cost) || 0) - (Number(a.estimated_cost) || 0)
  );

  const proposals: CostSavingProposal[] = [];
  let accumulatedSavings = 0;

  for (const item of sorted) {
    const cost = Number(item.estimated_cost) || 0;
    const cat = (item.category || "Sightseeing").toLowerCase();

    let proposedTitle = "";
    let proposedCost = 0;
    let tradeOff = "";

    // Practical, explainable alternative based on category
    if (/food|dining|restaurant/i.test(cat)) {
      // Dining alternatives
      proposedTitle = `Local Market Tasting or Casual Bistro (${item.title})`;
      proposedCost = Math.round(cost * 0.45 * 100) / 100; // ~55% savings
      tradeOff = "Casual dining or food stall experience instead of a full-service seated restaurant.";
    } else if (/adventure|nature/i.test(cat)) {
      // Outdoor / Adventure
      proposedTitle = `Self-Guided Scenic Route & Public Viewpoints (${item.title})`;
      proposedCost = Math.round(cost * 0.25 * 100) / 100; // ~75% savings
      tradeOff = "Self-guided nature exploration instead of paid private excursion gear/guide.";
    } else if (/culture|history|museum/i.test(cat)) {
      // Culture / Museum
      proposedTitle = `Free Landmark Exploration & Audio Guide (${item.title})`;
      proposedCost = Math.round(cost * 0.3 * 100) / 100; // ~70% savings
      tradeOff = "Independent visit or exterior architectural tour; verify museum free-entry days locally.";
    } else {
      // General Sightseeing / Tours
      proposedTitle = `Self-Guided Walking Tour (${item.title})`;
      proposedCost = Math.round(cost * 0.2 * 100) / 100; // ~80% savings
      tradeOff = "Self-paced walking tour instead of commercial tour operator. Requires self-navigation.";
    }

    const estimatedSavings = Math.round((cost - proposedCost) * 100) / 100;

    proposals.push({
      id: `save-${item.id}`,
      itemId: item.id,
      currentTitle: item.title,
      currentCost: cost,
      currentCategory: item.category || "Sightseeing",
      dayNumber: item.day_number || 1,
      proposedTitle,
      proposedCost,
      estimatedSavings,
      tradeOff,
      confidence: "ai_estimate",
      requiresVerification: true,
      selectedByDefault: true,
    });

    accumulatedSavings += estimatedSavings;

    // Stop accumulating when target 30% savings threshold is comfortably met
    if (accumulatedSavings >= targetSavings && proposals.length >= 2) {
      break;
    }
  }

  const projectedSavings = proposals.reduce((sum, p) => sum + p.estimatedSavings, 0);
  const achievedPercentage =
    currentPlannedCost > 0
      ? Math.round((projectedSavings / currentPlannedCost) * 1000) / 10
      : 0;

  return {
    currentPlannedCost,
    targetPlannedCost,
    targetSavings,
    projectedSavings,
    achievedPercentage,
    proposals,
    isEligible: true,
    summary: `Targeting 30% reduction (${targetSavings.toLocaleString()} ${primaryCurrency}) across ${proposals.length} high-cost items.`,
  };
}
