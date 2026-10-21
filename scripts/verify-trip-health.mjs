/**
 * Verification Script for Feature 1: Trip Health Score Engine
 * Tests all 16 required scenarios deterministically without database mutations or network calls.
 *
 * Execution:
 * node --experimental-strip-types scripts/verify-trip-health.mjs
 */

import { computeTripHealth, haversineDistanceKm, parseTimeToMinutes } from "../lib/scoring/tripHealth.ts";

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
console.log("GlobeTrotter — Trip Health Score Verification Suite (16 Cases)");
console.log("=================================================================\n");

// -----------------------------------------------------------------------------
// Case 1: Empty Trip (0 items, 0 stops, 0 budget)
// -----------------------------------------------------------------------------
console.log("Test 1: Empty Trip");
{
  const res = computeTripHealth({
    trip: { id: "trip-1", total_budget: 0, currency: "USD" },
    items: [],
    stops: [],
    expenses: [],
  });
  assert(res.score >= 90 && res.score <= 100, `Empty trip produces valid score (${res.score})`);
  assert(res.breakdown.budgetFit.score === 20, "Budget score is 20 (no cap set)");
  assert(res.breakdown.scheduleConflicts.score === 25, "Schedule conflicts score is 25 (no items)");
  assert(res.breakdown.dailyWorkload.score === 15, "Daily workload score is 15 (no activities note)");
  assert(res.suggestions.some((s) => s.id === "suggest-add-activities"), "Suggests adding activities");
}

// -----------------------------------------------------------------------------
// Case 2: Missing or Unset Budget (null or 0 total_budget)
// -----------------------------------------------------------------------------
console.log("\nTest 2: Missing or Unset Budget");
{
  const res = computeTripHealth({
    trip: { id: "trip-2", total_budget: null, currency: "USD" },
    items: [
      { id: "i1", day_number: 1, title: "Museum Visit", estimated_cost: 50, currency: "USD" },
      { id: "i2", day_number: 1, title: "Dinner", estimated_cost: 100, currency: "USD" },
    ],
  });
  assert(res.breakdown.budgetFit.score === 20, "Unset budget receives full 20 points without penalty");
  assert(
    res.dataLimitations.some((d) => d.includes("No positive total budget cap")),
    "Discloses that no budget cap is set in data limitations"
  );
}

// -----------------------------------------------------------------------------
// Case 3: Trip Within Budget (total cost <= total_budget)
// -----------------------------------------------------------------------------
console.log("\nTest 3: Trip Within Budget");
{
  const res = computeTripHealth({
    trip: { id: "trip-3", total_budget: 500, currency: "USD" },
    items: [
      { id: "i1", day_number: 1, title: "City Tour", estimated_cost: 150, currency: "USD" },
      { id: "i2", day_number: 2, title: "Museum Pass", estimated_cost: 200, currency: "USD" },
    ],
    expenses: [{ id: "e1", amount: 50, currency: "USD" }],
  });
  assert(res.breakdown.budgetFit.score === 20, "Budget score is 20/20 when spending (400) <= budget (500)");
  assert(res.breakdown.budgetFit.status === "excellent", "Budget status is 'excellent'");
}

// -----------------------------------------------------------------------------
// Case 4: Budget Exceeded (slight, moderate, severe overruns)
// -----------------------------------------------------------------------------
console.log("\nTest 4: Budget Exceeded");
{
  // 5% overrun
  const resSlight = computeTripHealth({
    trip: { id: "trip-4a", total_budget: 1000, currency: "USD" },
    items: [{ id: "i1", day_number: 1, title: "Helicopter Tour", estimated_cost: 1050, currency: "USD" }],
  });
  assert(resSlight.breakdown.budgetFit.score === 15, `Slight overrun (5%) awards 15/20 (got ${resSlight.breakdown.budgetFit.score})`);

  // 20% overrun
  const resMod = computeTripHealth({
    trip: { id: "trip-4b", total_budget: 1000, currency: "USD" },
    items: [{ id: "i1", day_number: 1, title: "Luxury Stay", estimated_cost: 1200, currency: "USD" }],
  });
  assert(resMod.breakdown.budgetFit.score === 10, `Moderate overrun (20%) awards 10/20 (got ${resMod.breakdown.budgetFit.score})`);

  // 40% overrun
  const resSevere = computeTripHealth({
    trip: { id: "trip-4c", total_budget: 1000, currency: "USD" },
    items: [{ id: "i1", day_number: 1, title: "Safari Trip", estimated_cost: 1400, currency: "USD" }],
  });
  assert(resSevere.breakdown.budgetFit.score === 0, `Severe overrun (40%) awards 0/20 (got ${resSevere.breakdown.budgetFit.score})`);
  assert(resSevere.issues.some((i) => i.id === "budget-severe-overrun"), "Flags critical budget deficit issue");
}

// -----------------------------------------------------------------------------
// Case 5: Mixed Currencies (never sum without conversion)
// -----------------------------------------------------------------------------
console.log("\nTest 5: Mixed Currencies");
{
  const res = computeTripHealth({
    trip: { id: "trip-5", total_budget: 1000, currency: "USD" },
    items: [
      { id: "i1", day_number: 1, title: "Local Guide", estimated_cost: 300, currency: "USD" },
      { id: "i2", day_number: 1, title: "Euro Dinner", estimated_cost: 500, currency: "EUR" },
      { id: "i3", day_number: 2, title: "Tokyo Metro", estimated_cost: 2000, currency: "JPY" },
    ],
  });
  // Primary USD spent is 300 <= 1000, so primary budget check is not exceeded
  assert(res.breakdown.budgetFit.score === 20, "Does not add EUR or JPY into USD budget; USD cost is 300/1000");
  assert(
    res.dataLimitations.some((d) => d.includes("EUR 500") && d.includes("JPY 2,000")),
    "Discloses secondary currencies (EUR 500, JPY 2,000) in data limitations"
  );
}

// -----------------------------------------------------------------------------
// Case 6: Unknown Activity Prices (disclosed, not treated as zero)
// -----------------------------------------------------------------------------
console.log("\nTest 6: Unknown Activity Prices");
{
  const res = computeTripHealth({
    trip: { id: "trip-6", total_budget: 500, currency: "USD" },
    items: [
      { id: "i1", day_number: 1, title: "Free Park", estimated_cost: 0, currency: "USD" },
      { id: "i2", day_number: 1, title: "Unknown Fee Museum", estimated_cost: null, currency: "USD" },
      { id: "i3", day_number: 1, title: "Boat Rental", estimated_cost: undefined, currency: "USD" },
    ],
  });
  assert(
    res.dataLimitations.some((d) => d.includes("2 activities have unknown or unpriced costs")),
    "Reports 2 activities with unknown costs in data limitations"
  );
  assert(
    res.issues.some((i) => i.id === "budget-unpriced-items"),
    "Generates info alert for unpriced activities"
  );
}

// -----------------------------------------------------------------------------
// Case 7: Overlapping Activities (same day interval overlap)
// -----------------------------------------------------------------------------
console.log("\nTest 7: Overlapping Activities");
{
  const res = computeTripHealth({
    trip: { id: "trip-7", currency: "USD" },
    items: [
      { id: "a1", day_number: 1, title: "Art Tour", start_time: "10:00", end_time: "12:00" },
      { id: "a2", day_number: 1, title: "Cooking Class", start_time: "11:30", end_time: "13:30" },
    ],
  });
  assert(res.breakdown.scheduleConflicts.score === 15, "1 conflict deducts 10 pts (25 -> 15)");
  assert(
    res.issues.some((i) => i.id === "conflict-a1-a2" && i.severity === "critical"),
    "Records critical conflict between overlapping activities"
  );
}

// -----------------------------------------------------------------------------
// Case 8: Non-Overlapping Activities (clear chronological order)
// -----------------------------------------------------------------------------
console.log("\nTest 8: Non-Overlapping Activities");
{
  const res = computeTripHealth({
    trip: { id: "trip-8", currency: "USD" },
    items: [
      { id: "b1", day_number: 1, title: "Morning Walk", start_time: "09:00", end_time: "10:30" },
      { id: "b2", day_number: 1, title: "Lunch Tasting", start_time: "12:00", end_time: "13:30" },
      { id: "b3", day_number: 1, title: "Sunset Cruise", start_time: "17:00", end_time: "19:00" },
    ],
  });
  assert(res.breakdown.scheduleConflicts.score === 25, "Non-overlapping items receive 25/25");
  assert(res.breakdown.scheduleConflicts.status === "excellent", "Status is 'excellent'");
}

// -----------------------------------------------------------------------------
// Case 9: Five and Six Activities on a Day (thresholds: 5 busy, 6+ overloaded)
// -----------------------------------------------------------------------------
console.log("\nTest 9: Five and Six Activities on a Day");
{
  // 5 activities on Day 1
  const res5 = computeTripHealth({
    trip: { id: "trip-9a", start_date: "2026-11-01", end_date: "2026-11-01", currency: "USD" },
    items: Array.from({ length: 5 }, (_, i) => ({
      id: `it-${i}`,
      day_number: 1,
      title: `Activity ${i + 1}`,
      estimated_cost: 10,
    })),
  });
  assert(res5.breakdown.dailyWorkload.score === 18, "5 activities deducts 2 pts (20 -> 18)");
  assert(res5.issues.some((i) => i.id === "workload-busy-day-1"), "Flags Day 1 as moderately busy");

  // 6 activities on Day 1
  const res6 = computeTripHealth({
    trip: { id: "trip-9b", start_date: "2026-11-01", end_date: "2026-11-01", currency: "USD" },
    items: Array.from({ length: 6 }, (_, i) => ({
      id: `it-${i}`,
      day_number: 1,
      title: `Activity ${i + 1}`,
      estimated_cost: 10,
    })),
  });
  assert(res6.breakdown.dailyWorkload.score === 15, "6 activities deducts 5 pts (20 -> 15)");
  assert(res6.issues.some((i) => i.id === "workload-overload-day-1"), "Flags Day 1 as overloaded");
}

// -----------------------------------------------------------------------------
// Case 10: Empty Days Within the Trip Dates
// -----------------------------------------------------------------------------
console.log("\nTest 10: Empty Days Within Trip Dates");
{
  const res = computeTripHealth({
    trip: { id: "trip-10", start_date: "2026-11-01", end_date: "2026-11-03", currency: "USD" }, // 3 days
    items: [
      { id: "d1", day_number: 1, title: "Arrival Dinner", estimated_cost: 50 },
      // Day 2 has no activities
      { id: "d3", day_number: 3, title: "Departure Breakfast", estimated_cost: 20 },
    ],
  });
  assert(
    res.issues.some((i) => i.id === "workload-empty-day-2"),
    "Identifies Day 2 as an empty day within the 3-day travel window"
  );
  assert(res.breakdown.dailyWorkload.score === 19, "Minor 1 pt deduction for empty day (20 -> 19)");
}

// -----------------------------------------------------------------------------
// Case 11: Rushed Transitions (<15m) and Untimed Activities
// -----------------------------------------------------------------------------
console.log("\nTest 11: Rushed Transitions (<15m) and Untimed Activities");
{
  const res = computeTripHealth({
    trip: { id: "trip-11", currency: "USD" },
    items: [
      { id: "r1", day_number: 1, title: "Palace Tour", start_time: "10:00", end_time: "11:30" },
      { id: "r2", day_number: 1, title: "Gallery Entry", start_time: "11:35", end_time: "12:30" }, // 5 min gap!
      { id: "r3", day_number: 1, title: "Untimed Dinner", start_time: null, end_time: null },
    ],
  });
  assert(res.breakdown.restTime.score === 15, "5 min rushed gap deducts 5 pts (20 -> 15)");
  assert(
    res.issues.some((i) => i.id === "rushed-transition-r1-r2"),
    "Flags rushed transition between r1 and r2"
  );
  assert(
    res.dataLimitations.some((d) => d.includes("1 activity has no specific time slots assigned")),
    "Discloses untimed activity without penalizing score"
  );
}

// -----------------------------------------------------------------------------
// Case 12: Invalid or Missing Time Values (start >= end, malformed times)
// -----------------------------------------------------------------------------
console.log("\nTest 12: Invalid or Missing Time Values");
{
  const res = computeTripHealth({
    trip: { id: "trip-12", currency: "USD" },
    items: [
      { id: "inv1", day_number: 1, title: "Backwards Event", start_time: "15:00", end_time: "14:00" },
      { id: "inv2", day_number: 1, title: "Garbage Time", start_time: "not-a-time", end_time: "invalid" },
    ],
  });
  assert(
    res.issues.some((i) => i.id === "invalid-time-window-inv1"),
    "Flags invalid time window where start time is after end time"
  );
  assert(
    res.breakdown.scheduleConflicts.score === 25,
    "Malformed times do not cause false schedule overlaps (25/25)"
  );
}

// -----------------------------------------------------------------------------
// Case 13: Consecutive Stops with Valid Coordinates (Haversine & Same-Day Transfer)
// -----------------------------------------------------------------------------
console.log("\nTest 13: Consecutive Stops with Valid Coordinates");
{
  // Paris (48.8566, 2.3522) to Nice (43.7102, 7.2620) is ~685 km
  const parisNiceDist = haversineDistanceKm(48.8566, 2.3522, 43.7102, 7.262);
  assert(parisNiceDist > 680 && parisNiceDist < 690, `Haversine distance is accurate (~${Math.round(parisNiceDist)} km)`);

  const res = computeTripHealth({
    trip: { id: "trip-13", currency: "EUR" },
    stops: [
      {
        id: "stop-paris",
        custom_city_name: "Paris",
        order_index: 1,
        arrival_date: "2026-11-01",
        departure_date: "2026-11-04",
        cities: { name: "Paris", latitude: 48.8566, longitude: 2.3522 },
      },
      {
        id: "stop-nice",
        custom_city_name: "Nice",
        order_index: 2,
        arrival_date: "2026-11-04", // Same day transfer!
        departure_date: "2026-11-08",
        cities: { name: "Nice", latitude: 43.7102, longitude: 7.262 },
      },
    ],
    items: [
      // 4 activities scheduled on the transition date/stops
      { id: "act-1", trip_stop_id: "stop-paris", day_number: 4, title: "Morning Croissant" },
      { id: "act-2", trip_stop_id: "stop-paris", day_number: 4, title: "Louvre Speedrun" },
      { id: "act-3", trip_stop_id: "stop-nice", day_number: 4, title: "Boardwalk Walk" },
      { id: "act-4", trip_stop_id: "stop-nice", day_number: 4, title: "Late Dinner" },
    ],
  });

  assert(res.breakdown.travelFeasibility.score === 10, "Long-distance same-day transfer with 4 activities deducts 5 pts (15 -> 10)");
  assert(
    res.issues.some((i) => i.id === "long-distance-same-day-stop-paris-stop-nice"),
    "Flags high transit friction for long-distance same-day journey"
  );
}

// -----------------------------------------------------------------------------
// Case 14: Missing Coordinates and Custom Destinations (no false deductions)
// -----------------------------------------------------------------------------
console.log("\nTest 14: Missing Coordinates and Custom Destinations");
{
  const res = computeTripHealth({
    trip: { id: "trip-14", currency: "USD" },
    items: [],
    stops: [
      {
        id: "stop-custom-1",
        custom_city_name: "My Remote Village",
        order_index: 1,
        arrival_date: "2026-11-01",
        departure_date: "2026-11-03",
        cities: null, // No catalog city or coordinates
      },
      {
        id: "stop-custom-2",
        custom_city_name: "Cozy Mountain Cabin",
        order_index: 2,
        arrival_date: "2026-11-03",
        departure_date: "2026-11-06",
        cities: null,
      },
    ],
  });
  assert(
    res.breakdown.travelFeasibility.score === 15,
    "Missing coordinates do not reduce score; awards 15/15"
  );
  assert(
    res.dataLimitations.some((d) => d.includes("lacks catalog coordinates")),
    "Discloses missing coordinates in data limitations"
  );
}

// -----------------------------------------------------------------------------
// Case 15: Inconsistent Stop Dates (departure < arrival or backward order)
// -----------------------------------------------------------------------------
console.log("\nTest 15: Inconsistent Stop Dates");
{
  const res = computeTripHealth({
    trip: { id: "trip-15", currency: "USD" },
    items: [],
    stops: [
      {
        id: "bad-stop-1",
        custom_city_name: "Time Machine City",
        order_index: 1,
        arrival_date: "2026-11-10",
        departure_date: "2026-11-05", // Departs 5 days BEFORE arriving!
      },
    ],
  });
  assert(res.breakdown.travelFeasibility.score === 10, "Inconsistent stop dates deducts 5 pts (15 -> 10)");
  assert(
    res.issues.some((i) => i.id === "stop-dates-inverted-bad-stop-1" && i.severity === "critical"),
    "Records critical issue for inverted stop dates"
  );
}

// -----------------------------------------------------------------------------
// Case 16: Score Boundaries & Deterministic Repeated Results
// -----------------------------------------------------------------------------
console.log("\nTest 16: Score Boundaries & Deterministic Repeated Results");
{
  const complexInput = {
    trip: { id: "trip-complex", total_budget: 1500, currency: "USD", start_date: "2026-12-01", end_date: "2026-12-05" },
    items: [
      { id: "i1", day_number: 1, title: "Breakfast", start_time: "08:30", end_time: "09:30", estimated_cost: 30, currency: "USD" },
      { id: "i2", day_number: 1, title: "Cathedral", start_time: "10:00", end_time: "11:30", estimated_cost: 40, currency: "USD" },
      { id: "i3", day_number: 1, title: "Lunch", start_time: "12:00", end_time: "13:30", estimated_cost: 50, currency: "USD" },
      { id: "i4", day_number: 2, title: "Museum", start_time: "09:00", end_time: "11:00", estimated_cost: 60, currency: "USD" },
    ],
    stops: [
      {
        id: "stop-1",
        custom_city_name: "Rome",
        order_index: 1,
        arrival_date: "2026-12-01",
        departure_date: "2026-12-05",
        cities: { name: "Rome", latitude: 41.9028, longitude: 12.4964 },
      },
    ],
    expenses: [{ id: "e1", amount: 200, currency: "USD" }],
  };

  const run1 = computeTripHealth(complexInput);
  const run2 = computeTripHealth(complexInput);
  const run3 = computeTripHealth(complexInput);

  assert(run1.score === run2.score && run2.score === run3.score, `Repeated runs yield identical score (${run1.score})`);
  assert(run1.grade === run2.grade, `Repeated runs yield identical grade (${run1.grade})`);
  assert(run1.score >= 0 && run1.score <= 100, `Score is bounded within [0, 100] (${run1.score})`);
  assert(
    JSON.stringify(run1.breakdown) === JSON.stringify(run2.breakdown),
    "Breakdown is 100% deterministic across repeated calls"
  );
}

// -----------------------------------------------------------------------------
// Extra Safeguard: Double-Counting Prevention
// -----------------------------------------------------------------------------
console.log("\nExtra Safeguard: Expense Double-Counting Prevention");
{
  const res = computeTripHealth({
    trip: { id: "trip-dc", total_budget: 100, currency: "USD" },
    items: [
      { id: "item-linked", day_number: 1, title: "Hotel Booking", estimated_cost: 80, currency: "USD" },
    ],
    expenses: [
      { id: "exp-linked", amount: 80, currency: "USD", itinerary_item_id: "item-linked" },
    ],
  });
  assert(res.breakdown.budgetFit.score === 20, "Safeguard successfully avoids double-counting linked expense and item estimate");
}

console.log("\n=================================================================");
console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=================================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

