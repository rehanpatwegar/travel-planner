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

// -----------------------------------------------------------------------------
// Realistic Travel Budget Benchmark Estimator
// -----------------------------------------------------------------------------

export interface EstimateBudgetParams {
  destination: string;
  startDate?: string | null;
  endDate?: string | null;
  totalDays?: number | null;
  travelersCount?: number | null;
  currency?: string | null;
  pace?: "relaxed" | "moderate" | "fast-paced" | null;
  destinationsCount?: number | null;
  userBudget?: number | null;
}

export interface RealisticBudgetEstimate {
  primaryCurrency: string;
  targetBudget: number;       // User's stated budget (0 if not specified)
  totalEstimatedCost: number; // Single source of truth for estimated total
  status: "within_budget" | "exceeds_budget" | "comfortable";
  variance: number;           // targetBudget - totalEstimatedCost (if targetBudget > 0)
  shortfallAmount?: number;   // when totalEstimatedCost > targetBudget
  remainingBuffer?: number;   // when targetBudget >= totalEstimatedCost
  advice: string;             // Actionable explanation
  totalDays: number;
  travelersCount: number;
  roomsCount: number;
  nightsCount: number;
  destinationsCount: number;
  pace: "relaxed" | "moderate" | "fast-paced";
  breakdown: {
    accommodation: {
      total: number;
      nightlyRate: number;
      nights: number;
      rooms: number;
      details: string;
    };
    food: {
      total: number;
      dailyRatePerPerson: number;
      days: number;
      travelers: number;
      details: string;
    };
    transport: {
      total: number;
      localTransit: number;
      intercityTransit: number;
      details: string;
    };
    activities: {
      total: number;
      dailyRatePerPerson: number;
      days: number;
      travelers: number;
      details: string;
    };
    contingencyBuffer: {
      total: number;
      percentage: number;
      details: string;
    };
  };
  assumptions: string[];
}

/**
 * Currency conversion reference ratios relative to USD (1.0 USD benchmark).
 */
const CURRENCY_RATIOS_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  CHF: 0.88,
  JPY: 155.0,
  INR: 86.0,
  CAD: 1.38,
  AUD: 1.52,
  SGD: 1.32,
  AED: 3.67,
  THB: 35.0,
  NZD: 1.68,
};

/**
 * Converts a base amount from a source currency to the target trip currency.
 */
function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  const fromRate = CURRENCY_RATIOS_TO_USD[fromCurrency.toUpperCase()] || 1.0;
  const toRate = CURRENCY_RATIOS_TO_USD[toCurrency.toUpperCase()] || 1.0;
  const usdAmount = amount / fromRate;
  const targetAmount = usdAmount * toRate;
  return targetAmount;
}

/**
 * Destination-specific benchmark rates across 3 economic tiers (native currency).
 */
interface DestinationBenchmarkRates {
  nativeCurrency: string;
  roomNightly: { budget: number; moderate: number; upscale: number };
  foodDailyPerPerson: { budget: number; moderate: number; upscale: number };
  localTransitDailyPerPerson: { budget: number; moderate: number; upscale: number };
  intercityTransitPerPerson: number;
  activitiesDailyPerPerson: { budget: number; moderate: number; upscale: number };
}

function getDestinationBenchmarks(dest: string): DestinationBenchmarkRates {
  const place = (dest || "").toLowerCase();

  // 1. India / South Asia
  if (
    /india|delhi|mumbai|bengaluru|bangalore|kolkata|chennai|hyderabad|pune|jaipur|agra|goa|kerala|kochi|ladakh|leh|varanasi|lucknow|shimla|manali|amritsar/i.test(
      place
    )
  ) {
    return {
      nativeCurrency: "INR",
      roomNightly: { budget: 1800, moderate: 3200, upscale: 5200 },
      foodDailyPerPerson: { budget: 600, moderate: 1100, upscale: 1900 },
      localTransitDailyPerPerson: { budget: 200, moderate: 400, upscale: 750 },
      intercityTransitPerPerson: 1500,
      activitiesDailyPerPerson: { budget: 300, moderate: 600, upscale: 1200 },
    };
  }

  // 2. Japan
  if (/japan|tokyo|kyoto|osaka|hiroshima|hokkaido|fukuoka|nara/i.test(place)) {
    return {
      nativeCurrency: "JPY",
      roomNightly: { budget: 9500, moderate: 15500, upscale: 26000 },
      foodDailyPerPerson: { budget: 3000, moderate: 5000, upscale: 8500 },
      localTransitDailyPerPerson: { budget: 1000, moderate: 1600, upscale: 2500 },
      intercityTransitPerPerson: 13500, // Shinkansen leg
      activitiesDailyPerPerson: { budget: 1500, moderate: 3000, upscale: 5000 },
    };
  }

  // 3. Switzerland
  if (/switzerland|swiss|lucerne|luzern|zurich|geneva|interlaken|zermatt|alps|matterhorn/i.test(place)) {
    return {
      nativeCurrency: "CHF",
      roomNightly: { budget: 110, moderate: 180, upscale: 280 },
      foodDailyPerPerson: { budget: 40, moderate: 68, upscale: 105 },
      localTransitDailyPerPerson: { budget: 12, moderate: 22, upscale: 35 },
      intercityTransitPerPerson: 60,
      activitiesDailyPerPerson: { budget: 20, moderate: 45, upscale: 80 },
    };
  }

  // 4. United Kingdom
  if (/uk|united kingdom|london|england|edinburgh|scotland|manchester|oxford|cambridge/i.test(place)) {
    return {
      nativeCurrency: "GBP",
      roomNightly: { budget: 70, moderate: 120, upscale: 195 },
      foodDailyPerPerson: { budget: 25, moderate: 45, upscale: 75 },
      localTransitDailyPerPerson: { budget: 8, moderate: 14, upscale: 24 },
      intercityTransitPerPerson: 45,
      activitiesDailyPerPerson: { budget: 15, moderate: 28, upscale: 50 },
    };
  }

  // 5. Western / Southern Europe (Eurozone: Paris, Florence, Rome, Barcelona, Berlin, etc.)
  if (
    /france|paris|italy|rome|florence|venice|milan|spain|barcelona|madrid|germany|berlin|munich|netherlands|amsterdam|austria|vienna|portugal|lisbon|europe/i.test(
      place
    )
  ) {
    return {
      nativeCurrency: "EUR",
      roomNightly: { budget: 75, moderate: 125, upscale: 200 },
      foodDailyPerPerson: { budget: 28, moderate: 48, upscale: 80 },
      localTransitDailyPerPerson: { budget: 8, moderate: 12, upscale: 22 },
      intercityTransitPerPerson: 50,
      activitiesDailyPerPerson: { budget: 15, moderate: 25, upscale: 55 },
    };
  }

  // 6. Southeast Asia / Value destinations (Thailand, Bali, Vietnam, etc.)
  if (/thailand|bangkok|phuket|bali|indonesia|vietnam|hanoi|saigon|cambodia|philippines/i.test(place)) {
    return {
      nativeCurrency: "USD",
      roomNightly: { budget: 35, moderate: 65, upscale: 115 },
      foodDailyPerPerson: { budget: 15, moderate: 26, upscale: 45 },
      localTransitDailyPerPerson: { budget: 5, moderate: 10, upscale: 18 },
      intercityTransitPerPerson: 30,
      activitiesDailyPerPerson: { budget: 10, moderate: 20, upscale: 38 },
    };
  }

  // 7. North America / Global Default (NYC, California, Canada, Australia, etc.)
  return {
    nativeCurrency: "USD",
    roomNightly: { budget: 95, moderate: 150, upscale: 240 },
    foodDailyPerPerson: { budget: 32, moderate: 52, upscale: 85 },
    localTransitDailyPerPerson: { budget: 10, moderate: 16, upscale: 28 },
    intercityTransitPerPerson: 65,
    activitiesDailyPerPerson: { budget: 18, moderate: 32, upscale: 60 },
  };
}

/**
 * Computes uncalibrated 5-pillar cost for a specific tier ("budget" | "moderate" | "upscale").
 */
function computeTierEstimate(
  benchmarks: DestinationBenchmarkRates,
  tier: "budget" | "moderate" | "upscale",
  targetCurrency: string,
  totalDays: number,
  nightsCount: number,
  travelersCount: number,
  roomsCount: number,
  destinationsCount: number
) {
  const nightlyRate = Math.round(convertCurrency(benchmarks.roomNightly[tier], benchmarks.nativeCurrency, targetCurrency));
  const dailyFoodRate = Math.round(convertCurrency(benchmarks.foodDailyPerPerson[tier], benchmarks.nativeCurrency, targetCurrency));
  const dailyTransitRate = Math.round(convertCurrency(benchmarks.localTransitDailyPerPerson[tier], benchmarks.nativeCurrency, targetCurrency));
  const intercityLegRate = Math.round(convertCurrency(benchmarks.intercityTransitPerPerson, benchmarks.nativeCurrency, targetCurrency));
  const dailyActivityRate = Math.round(convertCurrency(benchmarks.activitiesDailyPerPerson[tier], benchmarks.nativeCurrency, targetCurrency));

  const accommodationTotal = Math.round(nightlyRate * nightsCount * roomsCount);
  const foodTotal = Math.round(dailyFoodRate * travelersCount * totalDays);
  const localTransitTotal = Math.round(dailyTransitRate * travelersCount * totalDays);
  const intercityLegs = Math.max(0, destinationsCount - 1);
  const intercityTotal = Math.round(intercityLegs * travelersCount * intercityLegRate);
  const transportTotal = localTransitTotal + intercityTotal;
  const activitiesTotal = Math.round(dailyActivityRate * travelersCount * totalDays);

  const subtotal = accommodationTotal + foodTotal + transportTotal + activitiesTotal;
  const bufferTotal = Math.round(subtotal * 0.10); // Standard 10% contingency buffer
  const totalCost = subtotal + bufferTotal;

  return {
    nightlyRate,
    dailyFoodRate,
    dailyTransitRate,
    intercityLegRate,
    intercityLegs,
    dailyActivityRate,
    accommodationTotal,
    foodTotal,
    localTransitTotal,
    intercityTotal,
    transportTotal,
    activitiesTotal,
    bufferTotal,
    subtotal,
    totalCost,
  };
}

/**
 * Computes a realistic, moderate destination-aware 5-pillar trip budget estimate that respects the user's budget.
 *
 * Guarantees:
 * 1. Realistic moderate baseline: neither luxury nor rock-bottom.
 * 2. User-budget calibrated:
 *    - If user budget is realistic, aligns close to the budget while keeping an intentional 5%-10% cushion.
 *    - If user budget is generous, stays moderate by default without artificial inflation.
 *    - If user budget is unworkably low, reports the shortfall honestly and offers practical adjustments.
 * 3. Accommodation uses price per night × nights × rooms required (Math.ceil(travelers / 2)).
 * 4. Food accounts for 3 daily meals across travelers and trip duration.
 * 5. Single source of truth: No double-counting, contingency buffer counted exactly once.
 */
export function estimateTripBenchmarkBudget(params: EstimateBudgetParams): RealisticBudgetEstimate {
  const dest = (params.destination || "Trip").trim();
  const targetCurrency = (params.currency || "USD").trim().toUpperCase();

  // 1. Calculate duration
  let totalDays = 3;
  if (params.totalDays && Number.isInteger(params.totalDays) && params.totalDays > 0) {
    totalDays = params.totalDays;
  } else if (params.startDate && params.endDate) {
    const s = new Date(params.startDate);
    const e = new Date(params.endDate);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0) totalDays = diff;
    }
  }

  const nightsCount = Math.max(1, totalDays - 1);
  const travelersCount = Math.max(1, Number(params.travelersCount) || 1);
  const roomsCount = Math.max(1, Math.ceil(travelersCount / 2));
  const destinationsCount = Math.max(1, Number(params.destinationsCount) || 1);
  const pace = params.pace === "relaxed" || params.pace === "fast-paced" ? params.pace : "moderate";

  // 2. Fetch destination benchmarks and calculate floor and moderate estimates
  const benchmarks = getDestinationBenchmarks(dest);

  const budgetFloor = computeTierEstimate(
    benchmarks,
    "budget",
    targetCurrency,
    totalDays,
    nightsCount,
    travelersCount,
    roomsCount,
    destinationsCount
  );

  const moderateBase = computeTierEstimate(
    benchmarks,
    "moderate",
    targetCurrency,
    totalDays,
    nightsCount,
    travelersCount,
    roomsCount,
    destinationsCount
  );

  const upscaleBase = computeTierEstimate(
    benchmarks,
    "upscale",
    targetCurrency,
    totalDays,
    nightsCount,
    travelersCount,
    roomsCount,
    destinationsCount
  );

  const rawUserBudget = Number(params.userBudget);
  const userBudget = !isNaN(rawUserBudget) && rawUserBudget > 0 ? rawUserBudget : 0;

  // 3. Calibrate budget according to user budget and destination reality
  let status: "within_budget" | "exceeds_budget" | "comfortable" = "within_budget";
  let advice = "";
  let shortfallAmount: number | undefined;
  let remainingBuffer: number | undefined;

  let activeTier = moderateBase;

  if (userBudget === 0) {
    // No budget specified: default based on travel style
    if (pace === "relaxed") {
      activeTier = budgetFloor;
    } else if (pace === "fast-paced") {
      activeTier = upscaleBase;
    } else {
      activeTier = moderateBase;
    }
    status = "comfortable";
    advice = `Standard Moderate Baseline: Estimated full trip expenses for ${travelersCount} traveler(s) across ${totalDays} days in ${dest} total ~${targetCurrency} ${activeTier.totalCost.toLocaleString()}. No spending cap was specified.`;
  } else if (userBudget < budgetFloor.totalCost) {
    // Budget is below the realistic floor (Shortfall)
    // Rule: NEVER artificially lower essential costs below reality just to match unworkable budget!
    activeTier = budgetFloor;
    status = "exceeds_budget";
    shortfallAmount = budgetFloor.totalCost - userBudget;
    const minLodging = budgetFloor.accommodationTotal;
    const viableDays = Math.max(1, Math.floor(userBudget / (budgetFloor.totalCost / totalDays)));

    advice = `Budget Shortfall (${targetCurrency} ${shortfallAmount.toLocaleString()} deficit): Your stated budget of ${targetCurrency} ${userBudget.toLocaleString()} is below the minimum realistic threshold of ~${targetCurrency} ${budgetFloor.totalCost.toLocaleString()} for ${totalDays} days in ${dest} for ${travelersCount} traveler(s). Minimum accommodation alone requires ~${targetCurrency} ${minLodging.toLocaleString()}. Practical adjustments: Consider shortening the trip to ${viableDays} day(s), opting for budget shared hostel dorms, prioritizing free self-guided sights, or increasing your budget by ~${targetCurrency} ${shortfallAmount.toLocaleString()}.`;
  } else if (userBudget > moderateBase.totalCost * 1.25) {
    // Generous budget: Keep trip moderate by default!
    // Rule: Do NOT arbitrarily inflate hotels or invent frivolous activities just to consume money.
    activeTier = moderateBase;
    status = "comfortable";
    remainingBuffer = Math.round(userBudget - moderateBase.totalCost);
    advice = `Generous Budget (${targetCurrency} ${remainingBuffer.toLocaleString()} surplus): Your stated budget of ${targetCurrency} ${userBudget.toLocaleString()} comfortably exceeds our moderate travel estimate (~${targetCurrency} ${moderateBase.totalCost.toLocaleString()}). We have kept your itinerary moderate by default without unnecessary spending, leaving you a generous cushion for fine dining, lodging upgrades, or unplanned excursions.`;
  } else {
    // Realistic target budget: Smoothly calibrate rates close to target with an intentional 5%-10% cushion!
    const targetSpent = Math.max(
      budgetFloor.totalCost,
      Math.min(moderateBase.totalCost, Math.round(userBudget * 0.92))
    );

    const ratio = Math.min(
      1.0,
      Math.max(0.0, (targetSpent - budgetFloor.totalCost) / Math.max(1, moderateBase.totalCost - budgetFloor.totalCost))
    );

    // Interpolate rates
    const nightlyRate = Math.round(budgetFloor.nightlyRate + ratio * (moderateBase.nightlyRate - budgetFloor.nightlyRate));
    const dailyFoodRate = Math.round(budgetFloor.dailyFoodRate + ratio * (moderateBase.dailyFoodRate - budgetFloor.dailyFoodRate));
    const dailyTransitRate = Math.round(budgetFloor.dailyTransitRate + ratio * (moderateBase.dailyTransitRate - budgetFloor.dailyTransitRate));
    const dailyActivityRate = Math.round(budgetFloor.dailyActivityRate + ratio * (moderateBase.dailyActivityRate - budgetFloor.dailyActivityRate));
    const intercityLegRate = moderateBase.intercityLegRate;

    const accommodationTotal = Math.round(nightlyRate * nightsCount * roomsCount);
    const foodTotal = Math.round(dailyFoodRate * travelersCount * totalDays);
    const localTransitTotal = Math.round(dailyTransitRate * travelersCount * totalDays);
    const intercityTotal = Math.round(moderateBase.intercityLegs * travelersCount * intercityLegRate);
    const transportTotal = localTransitTotal + intercityTotal;
    const activitiesTotal = Math.round(dailyActivityRate * travelersCount * totalDays);

    const subtotal = accommodationTotal + foodTotal + transportTotal + activitiesTotal;
    const bufferTotal = Math.round(subtotal * 0.10);
    const totalCost = subtotal + bufferTotal;

    activeTier = {
      nightlyRate,
      dailyFoodRate,
      dailyTransitRate,
      intercityLegRate,
      intercityLegs: moderateBase.intercityLegs,
      dailyActivityRate,
      accommodationTotal,
      foodTotal,
      localTransitTotal,
      intercityTotal,
      transportTotal,
      activitiesTotal,
      bufferTotal,
      subtotal,
      totalCost,
    };

    status = "within_budget";
    remainingBuffer = Math.round(userBudget - totalCost);
    advice = `Realistic Budget Fit: Your stated budget of ${targetCurrency} ${userBudget.toLocaleString()} aligns well with typical travel costs in ${dest}. Our calibrated plan estimates ~${targetCurrency} ${totalCost.toLocaleString()} across lodging, meals, transit, and sights, leaving a sensible reserve of ${targetCurrency} ${remainingBuffer.toLocaleString()} for personal incidentals.`;
  }

  // 4. Disclose transparent assumptions
  const assumptions: string[] = [
    `Accommodation: ${nightsCount} night(s) in ${roomsCount} room(s) @ ~${targetCurrency} ${activeTier.nightlyRate.toLocaleString()}/night (${travelersCount} traveler(s) sharing).`,
    `Food & Dining: 3 meals/day for ${travelersCount} traveler(s) across ${totalDays} days @ ~${targetCurrency} ${activeTier.dailyFoodRate.toLocaleString()}/person/day.`,
    `Local Transit: City transportation for ${travelersCount} traveler(s) @ ~${targetCurrency} ${activeTier.dailyTransitRate.toLocaleString()}/person/day.`,
  ];

  if (activeTier.intercityLegs > 0) {
    assumptions.push(
      `Intercity Travel: ${activeTier.intercityLegs} transfer leg(s) between destination stops @ ~${targetCurrency} ${activeTier.intercityLegRate.toLocaleString()}/person.`
    );
  }

  assumptions.push(
    `Activities & Sights: Curated admissions, tours & experiences @ ~${targetCurrency} ${activeTier.dailyActivityRate.toLocaleString()}/person/day (${pace} pace).`
  );
  assumptions.push(
    `Contingency & Tax Buffer: 10% allowance (~${targetCurrency} ${activeTier.bufferTotal.toLocaleString()}) for tourism taxes, tips, and unexpected incidentals.`
  );

  return {
    primaryCurrency: targetCurrency,
    targetBudget: userBudget,
    totalEstimatedCost: activeTier.totalCost,
    status,
    variance: userBudget > 0 ? Math.round(userBudget - activeTier.totalCost) : 0,
    shortfallAmount,
    remainingBuffer,
    advice,
    totalDays,
    travelersCount,
    roomsCount,
    nightsCount,
    destinationsCount,
    pace,
    breakdown: {
      accommodation: {
        total: activeTier.accommodationTotal,
        nightlyRate: activeTier.nightlyRate,
        nights: nightsCount,
        rooms: roomsCount,
        details: `${nightsCount} night(s) × ${roomsCount} room(s) @ ${targetCurrency} ${activeTier.nightlyRate.toLocaleString()}/night`,
      },
      food: {
        total: activeTier.foodTotal,
        dailyRatePerPerson: activeTier.dailyFoodRate,
        days: totalDays,
        travelers: travelersCount,
        details: `${totalDays} days × ${travelersCount} traveler(s) @ ${targetCurrency} ${activeTier.dailyFoodRate.toLocaleString()}/person/day`,
      },
      transport: {
        total: activeTier.transportTotal,
        localTransit: activeTier.localTransitTotal,
        intercityTransit: activeTier.intercityTotal,
        details: activeTier.intercityLegs > 0
          ? `Local transit (${targetCurrency} ${activeTier.localTransitTotal.toLocaleString()}) + ${activeTier.intercityLegs} intercity leg(s) (${targetCurrency} ${activeTier.intercityTotal.toLocaleString()})`
          : `Daily transit for ${travelersCount} traveler(s) across ${totalDays} days`,
      },
      activities: {
        total: activeTier.activitiesTotal,
        dailyRatePerPerson: activeTier.dailyActivityRate,
        days: totalDays,
        travelers: travelersCount,
        details: `${totalDays} days × ${travelersCount} traveler(s) @ ${targetCurrency} ${activeTier.dailyActivityRate.toLocaleString()}/person/day`,
      },
      contingencyBuffer: {
        total: activeTier.bufferTotal,
        percentage: 10,
        details: "10% safety buffer for tourism taxes, service fees, and incidental transit",
      },
    },
    assumptions,
  };
}

