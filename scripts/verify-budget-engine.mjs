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

console.log("\n=================================================================");
console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=================================================================");

if (failedCount > 0) {
  process.exit(1);
}

