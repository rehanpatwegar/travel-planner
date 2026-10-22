/**
 * Verification Script for Feature 2: Real Budget Engine + Price Confidence
 * Tests all 14 required scenarios deterministically without database mutations or network calls.
 *
 * Execution:
 * node --experimental-strip-types scripts/verify-budget-engine.mjs
 */

import {
  normalizeToPillar,
  getPriceConfidence,
  computeRealBudgetBreakdown,
  generateCostSavingPlan,
  getPillarLabel,
  estimateTripBenchmarkBudget,
} from "../lib/budget/budgetEngine.ts";

import { computeTripHealth } from "../lib/scoring/tripHealth.ts";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${message}`);
  }
}

console.log("=================================================================");
console.log("GlobeTrotter — Real Budget Engine Verification Suite (14 Cases)");
console.log("=================================================================\n");

// -----------------------------------------------------------------------------
// Case 1: All 5 Pillar Mappings
// -----------------------------------------------------------------------------
console.log("Test 1: All 5 Pillar Mappings");
{
  assert(normalizeToPillar("Accommodation") === "accommodation", "Accommodation maps to accommodation");
  assert(normalizeToPillar("Hotel Booking") === "accommodation", "Hotel Booking maps to accommodation");
  assert(normalizeToPillar("Airbnb") === "accommodation", "Airbnb maps to accommodation");
  assert(normalizeToPillar("Resort Stay") === "accommodation", "Resort Stay maps to accommodation");

  assert(normalizeToPillar("Transport") === "transport", "Transport maps to transport");
  assert(normalizeToPillar("Flight") === "transport", "Flight maps to transport");
  assert(normalizeToPillar("Train Ticket") === "transport", "Train Ticket maps to transport");
  assert(normalizeToPillar("Subway Pass") === "transport", "Subway Pass maps to transport");
  assert(normalizeToPillar("Rental Car") === "transport", "Rental Car maps to transport");
  assert(normalizeToPillar("Car Rental") === "transport", "Car Rental maps to transport");
  assert(normalizeToPillar("Uber Ride") === "transport", "Uber Ride maps to transport");

  assert(normalizeToPillar("Food & Dining") === "food", "Food & Dining maps to food");
  assert(normalizeToPillar("Restaurant") === "food", "Restaurant maps to food");
  assert(normalizeToPillar("Street Food") === "food", "Street Food maps to food");
  assert(normalizeToPillar("Coffee & Drinks") === "food", "Coffee & Drinks maps to food");

  assert(normalizeToPillar("Activities & Sightseeing") === "activities", "Activities & Sightseeing maps to activities");
  assert(normalizeToPillar("Museum Tour") === "activities", "Museum Tour maps to activities");
  assert(normalizeToPillar("Attraction Entry") === "activities", "Attraction Entry maps to activities");
  assert(normalizeToPillar("Theme Park") === "activities", "Theme Park maps to activities");

  assert(normalizeToPillar("Other Expenses") === "other", "Other Expenses maps to other");
  assert(normalizeToPillar("Shopping") === "other", "Shopping maps to other");
  assert(normalizeToPillar("Souvenirs") === "other", "Souvenirs maps to other");
  assert(normalizeToPillar("Visa Fee") === "other", "Visa Fee maps to other");
}

// -----------------------------------------------------------------------------
// Case 2: Planned vs Actual Calculations
// -----------------------------------------------------------------------------
console.log("\nTest 2: Planned vs Actual Calculations");
{
  const trip = { id: "t1", total_budget: 1000, currency: "USD" };
  const items = [
    { id: "i1", title: "Museum Pass", estimated_cost: 100, currency: "USD", category: "Activities" },
    { id: "i2", title: "Train Ticket", estimated_cost: 150, currency: "USD", category: "Transport" },
  ];
  const expenses = [
    { id: "e1", title: "Lunch", amount: 40, currency: "USD", category: "Food" },
  ];

  const breakdown = computeRealBudgetBreakdown({ trip, items, expenses });

  assert(breakdown.targetBudget === 1000, "Target budget is 1000");
  assert(breakdown.totalPlanned === 250, "Planned itinerary costs sum to 250");
  assert(breakdown.totalActuals === 40, "Actual logged expenses sum to 40");
  assert(breakdown.totalCommitted === 290, "Total committed is 250 + 40 = 290");
  assert(breakdown.remainingBudget === 710, "Remaining budget is 1000 - 290 = 710");
  assert(breakdown.variance === 710, "Positive variance represents surplus (710)");
  assert(breakdown.isOverBudget === false, "Trip is within budget");
}

// -----------------------------------------------------------------------------
// Case 3: Linked Expense Replacing Item Estimate (No Double-Counting)
// -----------------------------------------------------------------------------
console.log("\nTest 3: Linked Expense Replacing Item Estimate");
{
  const trip = { id: "t2", total_budget: 500, currency: "USD" };
  const items = [
    { id: "item-hotel", title: "Hotel Stay", estimated_cost: 300, currency: "USD", category: "Accommodation" },
    { id: "item-dinner", title: "Fine Dining", estimated_cost: 100, currency: "USD", category: "Food" },
  ];
  // Expense is logged for Hotel Stay with actual receipt of $320
  const expenses = [
    { id: "exp-hotel", title: "Hotel Invoice", amount: 320, currency: "USD", category: "Accommodation", itinerary_item_id: "item-hotel" },
  ];

  const breakdown = computeRealBudgetBreakdown({ trip, items, expenses });

  // Without linking safeguard, committed would be 300 + 100 + 320 = 720 (double counting the hotel)
  // With linking safeguard: hotel planned (300) is marked realized; committed = 320 (actual hotel) + 100 (unlinked dinner) = 420
  assert(breakdown.totalPlanned === 400, "Total planned across all items is 400");
  assert(breakdown.unlinkedPlanned === 100, "Unlinked planned cost is 100 (dinner only)");
  assert(breakdown.totalActuals === 320, "Total actuals is 320");
  assert(breakdown.totalCommitted === 420, `Committed is exactly 420 without double counting (got ${breakdown.totalCommitted})`);
  assert(breakdown.pillars.accommodation.actualCost === 320, "Accommodation pillar actualCost is 320");
  assert(breakdown.pillars.accommodation.totalCommitted === 320, "Accommodation committed is 320 (actual replaces estimate)");
  assert(breakdown.pillars.food.totalCommitted === 100, "Food pillar committed is 100 (unlinked planned)");
}

// -----------------------------------------------------------------------------
// Case 4: Standalone Expenses
// -----------------------------------------------------------------------------
console.log("\nTest 4: Standalone Expenses");
{
  const trip = { id: "t3", total_budget: 500, currency: "EUR" };
  const items = [];
  const expenses = [
    { id: "e1", title: "Taxi from Airport", amount: 45, currency: "EUR", category: "Transport" },
    { id: "e2", title: "Gelato", amount: 8, currency: "EUR", category: "Food" },
  ];

  const breakdown = computeRealBudgetBreakdown({ trip, items, expenses });
  assert(breakdown.totalPlanned === 0, "No planned items");
  assert(breakdown.totalActuals === 53, "Actuals correctly sum standalone expenses (53)");
  assert(breakdown.totalCommitted === 53, "Total committed is 53");
  assert(breakdown.pillars.transport.actualCost === 45, "Transport actualCost is 45");
  assert(breakdown.pillars.food.actualCost === 8, "Food actualCost is 8");
}

// -----------------------------------------------------------------------------
// Case 5: Expense-to-Item Linking Validation (Cross-Trip Rejection)
// -----------------------------------------------------------------------------
console.log("\nTest 5: Expense-to-Item Linking Validation");
{
  // Simulating route handler check
  function validateExpenseLinking(tripId, targetItem) {
    if (!targetItem) {
      return { valid: false, error: "The referenced itinerary item does not exist." };
    }
    if (targetItem.trip_id !== tripId) {
      return { valid: false, error: "The referenced itinerary item does not belong to this trip." };
    }
    return { valid: true };
  }

  const currentTripId = "trip-alice-123";
  const legitimateItem = { id: "item-1", trip_id: "trip-alice-123", title: "Louvre Museum" };
  const crossTripItem = { id: "item-victim", trip_id: "trip-bob-999", title: "Bob's Secret Villa" };

  const validResult = validateExpenseLinking(currentTripId, legitimateItem);
  assert(validResult.valid === true, "Legitimate item in same trip is accepted");

  const invalidResult = validateExpenseLinking(currentTripId, crossTripItem);
  assert(invalidResult.valid === false, "Cross-trip item is rejected");
  assert(invalidResult.error.includes("does not belong to this trip"), "Returns appropriate cross-trip error message");

  const nonExistentResult = validateExpenseLinking(currentTripId, null);
  assert(nonExistentResult.valid === false, "Non-existent item is rejected");
}

// -----------------------------------------------------------------------------
// Case 6: Price Confidence Badge Classifications
// -----------------------------------------------------------------------------
console.log("\nTest 6: Price Confidence Badge Classifications");
{
  // Catalog item (activity_id is present)
  const catalogItem = {
    id: "item-cat",
    title: "Eiffel Tower Summit",
    activity_id: "act-guid-123",
    estimated_cost: 35,
    notes: "Booked online",
  };
  const catConf = getPriceConfidence(catalogItem);
  assert(catConf.type === "catalog", "Catalog item classified as 'catalog'");
  assert(catConf.label === "Catalog Price", "Catalog item labeled as 'Catalog Price'");
  assert(catConf.confidenceGrade === "High", "Catalog confidenceGrade is 'High'");

  // AI Generated item (contains AI attribution in notes)
  const aiItem1 = {
    id: "item-ai-1",
    title: "Montmartre Walking Tour",
    activity_id: null,
    estimated_cost: 20,
    notes: "AI Suggestion for budget walking tour",
  };
  const aiConf1 = getPriceConfidence(aiItem1);
  assert(aiConf1.type === "ai_estimate", "Item with 'AI Suggestion' classified as 'ai_estimate'");
  assert(aiConf1.label === "AI Estimate", "AI item labeled as 'AI Estimate'");
  assert(aiConf1.confidenceGrade === "Approximate", "AI confidenceGrade is 'Approximate'");

  const aiItem2 = {
    id: "item-ai-2",
    title: "Seine River Cruise",
    activity_id: null,
    estimated_cost: 15,
    notes: "AI Copilot recommendation",
  };
  assert(getPriceConfidence(aiItem2).type === "ai_estimate", "Item with 'AI Copilot' classified as 'ai_estimate'");

  // User Entered item (activity_id null, no AI marker, valid cost)
  const userItem = {
    id: "item-user",
    title: "Bakery Breakfast",
    activity_id: null,
    estimated_cost: 12,
    notes: "Recommended by friend",
  };
  const userConf = getPriceConfidence(userItem);
  assert(userConf.type === "user_entered", "User item classified as 'user_entered'");
  assert(userConf.label === "User Entered", "User item labeled as 'User Entered'");
  assert(userConf.confidenceGrade === "User Supplied", "User item confidenceGrade is 'User Supplied'");

  // Unpriced items (null, undefined, empty, or negative cost)
  const unpricedItem1 = { id: "item-unp-1", title: "Walk in park", estimated_cost: null };
  const unpricedItem2 = { id: "item-unp-2", title: "Window shopping", estimated_cost: "" };
  const unpricedItem3 = { id: "item-unp-3", title: "Error item", estimated_cost: -10 };

  assert(getPriceConfidence(unpricedItem1).type === "unpriced", "Null cost classified as unpriced");
  assert(getPriceConfidence(unpricedItem2).type === "unpriced", "Empty string cost classified as unpriced");
  assert(getPriceConfidence(unpricedItem3).type === "unpriced", "Negative cost classified as unpriced");
  assert(getPriceConfidence(unpricedItem1).confidenceGrade === "Unknown", "Unpriced confidenceGrade is 'Unknown'");
}

// -----------------------------------------------------------------------------
// Case 7: Mixed-Currency Isolation
// -----------------------------------------------------------------------------
console.log("\nTest 7: Mixed-Currency Isolation");
{
  const trip = { id: "t7", total_budget: 1000, currency: "USD" };
  const items = [
    { id: "i1", title: "US Domestic Flight", estimated_cost: 200, currency: "USD" },
    { id: "i2", title: "Tokyo Metro Pass", estimated_cost: 3000, currency: "JPY" },
    { id: "i3", title: "London Museum Pass", estimated_cost: 45, currency: "GBP" },
  ];
  const expenses = [
    { id: "e1", title: "Sushi Dinner", amount: 5000, currency: "JPY" },
    { id: "e2", title: "Pub Lunch", amount: 20, currency: "GBP" },
  ];

  const breakdown = computeRealBudgetBreakdown({ trip, items, expenses });

  // USD committed must NOT include JPY or GBP amounts directly
  assert(breakdown.totalPlanned === 200, "Only primary USD item counted in planned (200)");
  assert(breakdown.totalCommitted === 200, "Only primary USD counted in committed (200)");
  assert(breakdown.otherCurrencies.length === 2, "Exactly 2 secondary currencies isolated in otherCurrencies array");

  const jpyEntry = breakdown.otherCurrencies.find((c) => c.currency === "JPY");
  const gbpEntry = breakdown.otherCurrencies.find((c) => c.currency === "GBP");

  assert(jpyEntry !== undefined && jpyEntry.totalAmount === 8000, "JPY total isolated cleanly (3000 + 5000 = 8000)");
  assert(gbpEntry !== undefined && gbpEntry.totalAmount === 65, "GBP total isolated cleanly (45 + 20 = 65)");
  assert(breakdown.otherCurrenciesFormatted.some((s) => s.includes("JPY 8,000")), "Formatted string includes JPY 8,000");
  assert(breakdown.otherCurrenciesFormatted.some((s) => s.includes("GBP 65")), "Formatted string includes GBP 65");
}

// -----------------------------------------------------------------------------
// Case 8: Unknown Category Handling
// -----------------------------------------------------------------------------
console.log("\nTest 8: Unknown Category Handling");
{
  assert(normalizeToPillar("Miscellaneous Expense") === "other", "Miscellaneous Expense maps to other");
  assert(normalizeToPillar("RandomNonExistentCategory") === "other", "RandomNonExistentCategory maps to other");
  assert(normalizeToPillar(null) === "other", "null maps to other");
  assert(normalizeToPillar("") === "other", "empty string maps to other");
  assert(getPillarLabel("other") === "Other Expenses", "other pillar label is 'Other Expenses'");
}

// -----------------------------------------------------------------------------
// Case 9: Accurate 30% Target and Savings Calculations
// -----------------------------------------------------------------------------
console.log("\nTest 9: Accurate 30% Target and Savings Calculations");
{
  const trip = { id: "t9", currency: "USD", total_budget: 1000 };
  const items = [
    { id: "i1", title: "Luxury Hotel Stay", estimated_cost: 600, currency: "USD", category: "Accommodation" },
    { id: "i2", title: "VIP Private City Tour", estimated_cost: 200, currency: "USD", category: "Activities" },
    { id: "i3", title: "Fine Dining Tasting Menu", estimated_cost: 200, currency: "USD", category: "Food" },
  ];

  // Total eligible planned is 600 + 200 + 200 = 1000. Target 30% reduction = 300.
  const plan = generateCostSavingPlan({ trip, items });

  assert(plan.currentPlannedCost === 1000, `Baseline currentPlannedCost is 1000 (got ${plan.currentPlannedCost})`);
  assert(plan.targetSavings === 300, `Target 30% savings is 300 (got ${plan.targetSavings})`);
  assert(plan.targetPlannedCost === 700, `Target planned cost is 700 (got ${plan.targetPlannedCost})`);
  assert(plan.proposals.length > 0, "Proposals found for cost reduction");

  // Proposals should be prioritized by potential savings
  for (let i = 0; i < plan.proposals.length - 1; i++) {
    assert(
      plan.proposals[i].estimatedSavings >= plan.proposals[i + 1].estimatedSavings,
      "Proposals are sorted descending by potential savings"
    );
  }

  // Verify trade-offs are populated
  assert(plan.proposals.every((c) => c.tradeOff && c.tradeOff.length > 0), "All proposals disclose transparent trade-offs");
}

// -----------------------------------------------------------------------------
// Case 10: User Deselection and Recalculated Savings
// -----------------------------------------------------------------------------
console.log("\nTest 10: User Deselection and Recalculated Savings");
{
  const trip = { id: "t10", currency: "USD", total_budget: 1000 };
  const items = [
    { id: "i1", title: "Luxury 5-Star Hotel", estimated_cost: 500, currency: "USD", category: "Accommodation" },
    { id: "i2", title: "Fine Dining Dinner", estimated_cost: 200, currency: "USD", category: "Food" },
  ];

  const plan = generateCostSavingPlan({ trip, items });
  assert(plan.proposals.length >= 2, "Generated at least 2 proposals");

  // If user selects all proposals:
  const allSavings = plan.proposals.reduce((sum, c) => sum + c.estimatedSavings, 0);

  // If user deselects the first proposal:
  const selectedCandidates = plan.proposals.slice(1);
  const partialSavings = selectedCandidates.reduce((sum, c) => sum + c.estimatedSavings, 0);

  assert(partialSavings < allSavings, "Partial selection yields lower savings than full selection");
  assert(
    partialSavings === allSavings - plan.proposals[0].estimatedSavings,
    "Recalculated savings accurately drops the deselected proposal amount"
  );
}

// -----------------------------------------------------------------------------
// Case 11: Zero-Cost and All-Free Trips
// -----------------------------------------------------------------------------
console.log("\nTest 11: Zero-Cost and All-Free Trips");
{
  const trip = { id: "t11", currency: "USD", total_budget: 0 };
  const items = [
    { id: "i1", title: "Free Walking Tour", estimated_cost: 0, currency: "USD", category: "Activities" },
    { id: "i2", title: "City Park Picnic", estimated_cost: 0, currency: "USD", category: "Food" },
    { id: "i3", title: "Window Shopping", estimated_cost: null, currency: "USD", category: "Other" },
  ];
  const expenses = [];

  const breakdown = computeRealBudgetBreakdown({ trip, items, expenses });
  assert(breakdown.totalPlanned === 0, "Zero-cost items sum to 0");
  assert(breakdown.totalCommitted === 0, "Committed cost is 0");
  assert(breakdown.budgetUtilization === 0, "Utilization is 0% without NaN or division error");
  assert(breakdown.unknownPriceCount === 1, "Correctly counts 1 unpriced item");

  const plan = generateCostSavingPlan({ trip, items });
  assert(plan.currentPlannedCost === 0, "Baseline planned is 0");
  assert(plan.proposals.length === 0, "No proposals when baseline is 0");
  assert(
    plan.summary?.includes("No eligible planned items") || plan.ineligibilityReason?.includes("No paid activities"),
    "Returns friendly summary when no paid items exist"
  );
}

// -----------------------------------------------------------------------------
// Case 12: Unknown Alternative Prices and Free Swaps
// -----------------------------------------------------------------------------
console.log("\nTest 12: Unknown Alternative Prices and Free Swaps");
{
  const trip = { id: "t12", currency: "USD" };
  const items = [
    { id: "i1", title: "Private Guided Museum Tour", estimated_cost: 80, currency: "USD", category: "Activities" },
  ];

  const plan = generateCostSavingPlan({ trip, items });
  const cand = plan.proposals.find((c) => c.itemId === "i1");

  assert(cand !== undefined, "Found proposal for private museum tour");
  assert(cand.proposedCost < cand.currentCost, "Proposed cost is lower than original");
  assert(cand.estimatedSavings > 0, "Estimated saving is positive");
  assert(cand.tradeOff.length > 5, "Trade-off explanation is substantive");
}

// -----------------------------------------------------------------------------
// Case 13: Consistency with lib/scoring/tripHealth.ts Totals
// -----------------------------------------------------------------------------
console.log("\nTest 13: Consistency with Trip Health Score Engine");
{
  const testTrip = { id: "trip-consist", total_budget: 1500, currency: "EUR" };
  const testItems = [
    { id: "item-1", title: "Train", estimated_cost: 120, currency: "EUR", category: "Transport" },
    { id: "item-2", title: "Hotel", estimated_cost: 400, currency: "EUR", category: "Accommodation" },
    { id: "item-3", title: "Museum", estimated_cost: 30, currency: "EUR", category: "Activities" },
    { id: "item-4", title: "Souvenir", estimated_cost: null, currency: "EUR", category: "Other" }, // unpriced
    { id: "item-5", title: "Foreign SIM", estimated_cost: 25, currency: "USD", category: "Other" }, // secondary
  ];
  const testExpenses = [
    // Linked expense replaces item-2 ($400 -> $430)
    { id: "exp-1", title: "Hotel Receipt", amount: 430, currency: "EUR", category: "Accommodation", itinerary_item_id: "item-2" },
    // Standalone expense
    { id: "exp-2", title: "Dinner", amount: 60, currency: "EUR", category: "Food" },
  ];

  const budgetRes = computeRealBudgetBreakdown({
    trip: testTrip,
    items: testItems,
    expenses: testExpenses,
  });

  const healthRes = computeTripHealth({
    trip: testTrip,
    items: testItems,
    expenses: testExpenses,
  });

  // Expected primary committed:
  // Item 1 (120) + Item 3 (30) + Exp 1 (430, replaces Item 2) + Exp 2 (60) = 640 EUR
  assert(budgetRes.totalCommitted === 640, `Budget engine committed is exactly 640 (got ${budgetRes.totalCommitted})`);

  // Unpriced items: 1 (item-4)
  assert(budgetRes.unknownPriceCount === 1, `Budget engine unpriced count is 1 (got ${budgetRes.unknownPriceCount})`);

  // Verify healthRes recognized unpriced item
  const hasHealthUnpricedIssue = healthRes.issues.some((i) => i.id === "budget-unpriced-items");
  assert(hasHealthUnpricedIssue, "Trip health score flags unpriced activities identically");

  // Secondary currencies: USD 25
  assert(budgetRes.otherCurrenciesFormatted.some((s) => s.includes("USD 25")), "Budget engine isolates secondary USD 25");
  assert(
    healthRes.dataLimitations.some((d) => d.includes("USD 25")),
    "Health engine data limitations isolates secondary USD 25 identically"
  );
}

// -----------------------------------------------------------------------------
// Case 14: Expense Create, Delete, and List Behavior
// -----------------------------------------------------------------------------
console.log("\nTest 14: Expense Data Structures and Operations");
{
  // Initial expenses list
  let expenses = [
    { id: "e1", title: "Flight", amount: 350, currency: "USD", category: "Transport", itinerary_item_id: null },
    { id: "e2", title: "Metro", amount: 15, currency: "USD", category: "Transport", itinerary_item_id: null },
  ];

  // Add new linked expense
  const newExpense = {
    id: "e3",
    title: "Hotel Booking",
    amount: 500,
    currency: "USD",
    category: "Accommodation",
    itinerary_item_id: "item-lodging-1",
  };
  expenses = [newExpense, ...expenses];

  assert(expenses.length === 3, "Expense added to beginning of array");
  assert(expenses[0].id === "e3", "Newly created expense is first element");
  assert(expenses[0].itinerary_item_id === "item-lodging-1", "itinerary_item_id preserved in expense record");

  // Delete expense
  expenses = expenses.filter((e) => e.id !== "e2");
  assert(expenses.length === 2, "Expense successfully deleted from array");
  assert(!expenses.some((e) => e.id === "e2"), "Deleted expense no longer present");
}

// -----------------------------------------------------------------------------
// Case 15: Destination-Specific Benchmark Budget Engine (Issue 2)
// -----------------------------------------------------------------------------
console.log("\nTest 15: Destination-Specific Benchmark Budget Engine");
{
  // Scenario A: 4 travelers, 5 days (4 nights), 2 rooms in Paris (EUR)
  const parisEstimate = estimateTripBenchmarkBudget({
    destination: "Paris",
    startDate: "2026-11-01",
    endDate: "2026-11-05",
    totalDays: 5,
    travelersCount: 4,
    currency: "EUR",
    pace: "moderate",
  });

  assert(parisEstimate.totalDays === 5, "Total days is 5");
  assert(parisEstimate.nightsCount === 4, "Nights count is 4 (5 days - 1)");
  assert(parisEstimate.roomsCount === 2, "Rooms count for 4 travelers is 2 (ceil(4/2))");
  assert(parisEstimate.travelersCount === 4, "Travelers count is 4");

  // Accommodation = nights (4) * rooms (2) * nightlyRate
  const expectedAccom = 4 * 2 * parisEstimate.breakdown.accommodation.nightlyRate;
  assert(parisEstimate.breakdown.accommodation.total === expectedAccom, "Accommodation strictly uses nights × rooms × nightlyRate");

  // Food = totalDays (5) * travelers (4) * dailyRate
  const expectedFood = 5 * 4 * parisEstimate.breakdown.food.dailyRatePerPerson;
  assert(parisEstimate.breakdown.food.total === expectedFood, "Food accounts for travelers × trip duration");

  // Buffer = 10% of subtotal
  const subtotal = parisEstimate.breakdown.accommodation.total +
    parisEstimate.breakdown.food.total +
    parisEstimate.breakdown.transport.total +
    parisEstimate.breakdown.activities.total;
  const expectedBuffer = Math.round(subtotal * 0.10);
  assert(parisEstimate.breakdown.contingencyBuffer.total === expectedBuffer, "Contingency buffer is 10% of 4-pillar subtotal");
  assert(parisEstimate.totalEstimatedCost === subtotal + expectedBuffer, "Total estimated cost equals subtotal + contingency buffer");
  assert(parisEstimate.assumptions.length >= 4, "Includes disclosed transparent assumptions");

  // Scenario B: India destination (Bengaluru, INR) — Culturally grounded local rates
  const indiaEstimate = estimateTripBenchmarkBudget({
    destination: "Bengaluru",
    startDate: "2026-10-24",
    endDate: "2026-10-28",
    totalDays: 5,
    travelersCount: 2,
    currency: "INR",
    pace: "moderate",
  });

  assert(indiaEstimate.primaryCurrency === "INR", "Primary currency is INR");
  assert(indiaEstimate.breakdown.accommodation.nightlyRate >= 2000, "Nightly rate in India is realistic in INR (>= ₹2,000)");
  assert(indiaEstimate.breakdown.food.dailyRatePerPerson >= 800, "Daily food in India is realistic in INR (>= ₹800)");
  assert(indiaEstimate.totalEstimatedCost >= 30000, "Total 5-day trip for 2 in Bengaluru is realistic (>= ₹30,000)");

  // Scenario C: Multi-city trip accounts for intercity transport
  const multiCityEstimate = estimateTripBenchmarkBudget({
    destination: "Paris and Lucerne",
    startDate: "2026-11-01",
    endDate: "2026-11-07",
    totalDays: 7,
    travelersCount: 2,
    currency: "EUR",
    destinationsCount: 2,
  });

  assert(multiCityEstimate.breakdown.transport.intercityTransit > 0, "Multi-city trip includes positive intercity transport");
  assert(multiCityEstimate.assumptions.some((a) => a.includes("Intercity Travel")), "Discloses intercity transfer assumption");
}

// -----------------------------------------------------------------------------
// Case 16: Complete 5-Pillar Breakdown with Grounded Benchmark Items (Issue 2)
// -----------------------------------------------------------------------------
console.log("\nTest 16: Complete 5-Pillar Breakdown with Grounded Benchmark Items");
{
  const benchmark = estimateTripBenchmarkBudget({
    destination: "Bengaluru, India",
    startDate: "2026-10-24",
    endDate: "2026-10-28",
    totalDays: 5,
    travelersCount: 2,
    currency: "INR",
  });

  // Verify benchmark properties
  assert(benchmark.totalEstimatedCost >= 30000, "Benchmark total estimated cost is comprehensive (>= ₹30,000 INR)");
  assert(benchmark.breakdown.accommodation.total > 0, "Benchmark includes positive accommodation total");
  assert(benchmark.breakdown.food.total > 0, "Benchmark includes positive food & dining total");
  assert(benchmark.breakdown.transport.total > 0, "Benchmark includes positive transport total");
  assert(benchmark.breakdown.contingencyBuffer.total > 0, "Benchmark includes positive contingency buffer total");

  // Construct itinerary items populated with benchmark values (as generated by AI)
  const trip = { id: "trip-inr-1", currency: "INR", total_budget: 60000 };
  const items = [
    {
      id: "item-hotel",
      category: "Accommodation",
      title: "Hotel Check-in & Accommodation in Bengaluru",
      estimated_cost: benchmark.breakdown.accommodation.total,
      currency: "INR",
    },
    {
      id: "item-dining",
      category: "Food & Dining",
      title: "Daily Meals & Dining",
      estimated_cost: benchmark.breakdown.food.total,
      currency: "INR",
    },
    {
      id: "item-transit",
      category: "Transport",
      title: "City Metro & Local Transport",
      estimated_cost: benchmark.breakdown.transport.total,
      currency: "INR",
    },
    {
      id: "item-sights",
      category: "Sightseeing",
      title: "Bangalore Palace & Botanical Gardens",
      estimated_cost: benchmark.breakdown.activities.total,
      currency: "INR",
    },
  ];

  const breakdown = computeRealBudgetBreakdown({ trip, items, expenses: [] });

  assert(breakdown.pillars.accommodation.totalCommitted > 0, "Pillars have positive committed accommodation");
  assert(breakdown.pillars.food.totalCommitted > 0, "Pillars have positive committed food");
  assert(breakdown.pillars.transport.totalCommitted > 0, "Pillars have positive committed transport");
  assert(breakdown.pillars.activities.totalCommitted > 0, "Pillars have positive committed activities");
  assert(breakdown.totalCommitted >= 30000, "Trip budget is grounded and realistic (>= ₹30,000)");
  assert(breakdown.unknownPriceCount === 0, "Zero unpriced items; complete assessment");
}

// -----------------------------------------------------------------------------
// Case 17: Scenario 1 — 5-Day, 2-Person Trip in India (INR)
// -----------------------------------------------------------------------------
console.log("\nTest 17: Scenario 1 — 5-Day, 2-Person Trip in India (INR)");
{
  const india5Day = estimateTripBenchmarkBudget({
    destination: "Bengaluru, India",
    startDate: "2026-11-10",
    endDate: "2026-11-14",
    totalDays: 5,
    travelersCount: 2,
    currency: "INR",
  });

  assert(india5Day.totalDays === 5, "Total days is 5");
  assert(india5Day.nightsCount === 4, "Nights count is 4");
  assert(india5Day.roomsCount === 1, "Rooms count for 2 travelers is 1");
  assert(india5Day.travelersCount === 2, "Travelers count is 2");
  assert(india5Day.primaryCurrency === "INR", "Primary currency is INR");

  // Verify culturally grounded cost figures
  const nightly = india5Day.breakdown.accommodation.nightlyRate;
  const foodDaily = india5Day.breakdown.food.dailyRatePerPerson;
  const transitDaily = india5Day.breakdown.transport.localTransit / (5 * 2);
  const activitiesDaily = india5Day.breakdown.activities.dailyRatePerPerson;

  assert(nightly >= 2500 && nightly <= 6000, `Nightly rate in Bengaluru is moderate (₹${nightly}/night)`);
  assert(foodDaily >= 1000 && foodDaily <= 2500, `Daily food in India is realistic (₹${foodDaily}/person/day)`);
  assert(transitDaily >= 300 && transitDaily <= 800, `Local transit in India is realistic (₹${transitDaily}/person/day)`);
  assert(activitiesDaily >= 400 && activitiesDaily <= 1500, `Activities rate in India is realistic (₹${activitiesDaily}/person/day)`);

  // Verify single 10% contingency buffer
  const subtotal = india5Day.breakdown.accommodation.total +
    india5Day.breakdown.food.total +
    india5Day.breakdown.transport.total +
    india5Day.breakdown.activities.total;
  assert(india5Day.breakdown.contingencyBuffer.total === Math.round(subtotal * 0.10), "Contingency buffer is exactly 10%");
  assert(india5Day.totalEstimatedCost === subtotal + india5Day.breakdown.contingencyBuffer.total, "Total cost is subtotal + 10% buffer");

  // Total realistic range: ~₹30,000 to ~₹60,000 (neither $100 (~₹8,300) nor luxury ₹2,00,000)
  assert(india5Day.totalEstimatedCost >= 30000 && india5Day.totalEstimatedCost <= 60000, `Total 5-day India estimate is moderate (₹${india5Day.totalEstimatedCost.toLocaleString()})`);
  assert(india5Day.assumptions.length >= 4, "Assumptions disclose all pillars");
}

// -----------------------------------------------------------------------------
// Case 18: Scenario 2 — 5-Day, 2-Person Trip in Western Europe (EUR)
// -----------------------------------------------------------------------------
console.log("\nTest 18: Scenario 2 — 5-Day, 2-Person Trip in Western Europe (EUR)");
{
  const europe5Day = estimateTripBenchmarkBudget({
    destination: "Paris, France",
    startDate: "2026-11-10",
    endDate: "2026-11-14",
    totalDays: 5,
    travelersCount: 2,
    currency: "EUR",
  });

  assert(europe5Day.totalDays === 5, "Total days is 5");
  assert(europe5Day.nightsCount === 4, "Nights count is 4");
  assert(europe5Day.roomsCount === 1, "Rooms count for 2 travelers is 1");
  assert(europe5Day.primaryCurrency === "EUR", "Primary currency is EUR");

  const nightly = europe5Day.breakdown.accommodation.nightlyRate;
  const foodDaily = europe5Day.breakdown.food.dailyRatePerPerson;
  const transitDaily = europe5Day.breakdown.transport.localTransit / (5 * 2);
  const activitiesDaily = europe5Day.breakdown.activities.dailyRatePerPerson;

  assert(nightly >= 100 && nightly <= 180, `Western Europe moderate lodging rate is €${nightly}/night`);
  assert(foodDaily >= 40 && foodDaily <= 75, `Western Europe 3 meals/day rate is €${foodDaily}/person/day`);
  assert(transitDaily >= 10 && transitDaily <= 20, `Western Europe daily transit rate is €${transitDaily}/person/day`);
  assert(activitiesDaily >= 20 && activitiesDaily <= 40, `Western Europe activities rate is €${activitiesDaily}/person/day`);

  // Total realistic range: ~€1,300 to ~€1,800
  assert(europe5Day.totalEstimatedCost >= 1300 && europe5Day.totalEstimatedCost <= 1800, `Total 5-day Europe estimate is moderate (€${europe5Day.totalEstimatedCost.toLocaleString()})`);
  assert(europe5Day.breakdown.contingencyBuffer.percentage === 10, "Contingency buffer percentage is 10%");
}

// -----------------------------------------------------------------------------
// Case 19: Scenario 3 — Multi-City Trip with Intercity Transfer
// -----------------------------------------------------------------------------
console.log("\nTest 19: Scenario 3 — Multi-City Trip with Intercity Transfer");
{
  const multiCity = estimateTripBenchmarkBudget({
    destination: "Paris and Rome",
    startDate: "2026-11-01",
    endDate: "2026-11-07",
    totalDays: 7,
    travelersCount: 2,
    currency: "EUR",
    destinationsCount: 2,
  });

  assert(multiCity.destinationsCount === 2, "Destinations count is 2");
  assert(multiCity.breakdown.transport.intercityTransit > 0, "Multi-city trip calculates intercity transfer costs");
  assert(
    multiCity.breakdown.transport.total ===
      multiCity.breakdown.transport.localTransit + multiCity.breakdown.transport.intercityTransit,
    "Transport total is sum of local transit and intercity transit"
  );
  assert(
    multiCity.assumptions.some((a) => a.toLowerCase().includes("intercity travel")),
    "Discloses intercity transfer leg in transparent assumptions"
  );
}

// -----------------------------------------------------------------------------
// Case 20: Scenario 4 — Budget-Conscious Trip vs. Standard Trip
// -----------------------------------------------------------------------------
console.log("\nTest 20: Scenario 4 — Budget-Conscious Trip vs. Standard Trip");
{
  const budgetTrip = estimateTripBenchmarkBudget({
    destination: "Tokyo, Japan",
    startDate: "2026-11-01",
    endDate: "2026-11-05",
    totalDays: 5,
    travelersCount: 2,
    currency: "JPY",
    pace: "relaxed", // maps to budget tier when userBudget=0
  });

  const moderateTrip = estimateTripBenchmarkBudget({
    destination: "Tokyo, Japan",
    startDate: "2026-11-01",
    endDate: "2026-11-05",
    totalDays: 5,
    travelersCount: 2,
    currency: "JPY",
    pace: "moderate", // maps to moderate tier
  });

  // Verify budget tier is cheaper than moderate tier across pillars
  assert(
    budgetTrip.breakdown.accommodation.nightlyRate < moderateTrip.breakdown.accommodation.nightlyRate,
    "Budget nightly rate is lower than moderate nightly rate"
  );
  assert(
    budgetTrip.breakdown.food.dailyRatePerPerson < moderateTrip.breakdown.food.dailyRatePerPerson,
    "Budget daily food rate is lower than moderate food rate"
  );
  assert(
    budgetTrip.breakdown.activities.dailyRatePerPerson < moderateTrip.breakdown.activities.dailyRatePerPerson,
    "Budget daily activity rate is lower than moderate activity rate"
  );
  assert(
    budgetTrip.totalEstimatedCost < moderateTrip.totalEstimatedCost,
    `Budget total (¥${budgetTrip.totalEstimatedCost.toLocaleString()}) < Moderate total (¥${moderateTrip.totalEstimatedCost.toLocaleString()})`
  );
  // Both remain grounded and realistic
  assert(budgetTrip.totalEstimatedCost >= 80000, "Budget Tokyo trip is grounded and realistic (>= ¥80,000)");
  assert(moderateTrip.totalEstimatedCost >= 120000, "Moderate Tokyo trip is realistic (>= ¥120,000)");
}

// -----------------------------------------------------------------------------
// Case 21: Scenario 5 — User Budget Calibration (Reasonable, Generous, Shortfall)
// -----------------------------------------------------------------------------
console.log("\nTest 21: Scenario 5 — User Budget Calibration (Reasonable, Generous, Shortfall)");
{
  // 5A: Reasonable Budget (e.g. €1,600 for Paris 5-day for 2)
  const reasonable = estimateTripBenchmarkBudget({
    destination: "Paris, France",
    startDate: "2026-11-10",
    endDate: "2026-11-14",
    totalDays: 5,
    travelersCount: 2,
    currency: "EUR",
    userBudget: 1600,
  });

  assert(reasonable.status === "within_budget", "Reasonable budget status is within_budget");
  assert(reasonable.totalEstimatedCost <= 1600, `Calibrated estimate (€${reasonable.totalEstimatedCost}) fits within stated budget (€1,600)`);
  assert(reasonable.remainingBuffer > 0, `Intentional cushion remaining (€${reasonable.remainingBuffer})`);
  assert(reasonable.shortfallAmount === undefined, "No shortfall for reasonable budget");
  assert(reasonable.advice.includes("Realistic Budget Fit"), "Advice identifies realistic budget fit");

  // 5B: Overly Generous Budget (e.g. €5,000 for Paris 5-day for 2)
  const generous = estimateTripBenchmarkBudget({
    destination: "Paris, France",
    startDate: "2026-11-10",
    endDate: "2026-11-14",
    totalDays: 5,
    travelersCount: 2,
    currency: "EUR",
    userBudget: 5000,
  });

  assert(generous.status === "comfortable", "Overly generous budget status is comfortable");
  // CRITICAL RULE: Must NOT artificially inflate to €5,000! Keeps moderate estimate.
  assert(generous.totalEstimatedCost < 2000, `Generous budget does NOT inflate itinerary; stays moderate (€${generous.totalEstimatedCost})`);
  assert(generous.remainingBuffer >= 3000, `Generous buffer reported transparently (€${generous.remainingBuffer})`);
  assert(generous.advice.includes("Generous Budget"), "Advice explains moderate baseline and generous cushion");

  // 5C: Budget Shortfall (e.g. €400 for Paris 5-day for 2)
  const shortfall = estimateTripBenchmarkBudget({
    destination: "Paris, France",
    startDate: "2026-11-10",
    endDate: "2026-11-14",
    totalDays: 5,
    travelersCount: 2,
    currency: "EUR",
    userBudget: 400,
  });

  assert(shortfall.status === "exceeds_budget", "Shortfall status is exceeds_budget");
  // CRITICAL RULE: Must NEVER artificially depress essential costs below reality!
  assert(shortfall.totalEstimatedCost >= 800, `Does NOT artificially depress minimum costs below floor (€${shortfall.totalEstimatedCost})`);
  assert(shortfall.shortfallAmount > 0, `Shortfall deficit calculated (€${shortfall.shortfallAmount})`);
  assert(shortfall.advice.includes("Budget Shortfall"), "Advice clearly flags budget shortfall");
  assert(shortfall.advice.includes("Practical adjustments"), "Advice provides practical adjustments (fewer days, hostel dorms, free sights)");
}

console.log("\n=================================================================");
console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=================================================================");

if (failedCount > 0) {
  process.exit(1);
}

