/**
 * Verification Script for Feature 3: Group Trip Split Engine
 * Tests all required split calculations, balances, currency isolation, and settlements.
 *
 * Execution:
 * node --experimental-strip-types scripts/verify-group-split-engine.mjs
 */

import {
  calculateEqualSplit,
  computeSettlementTransactions,
  computeGroupBalances,
  toCents,
  fromCents,
} from "../lib/budget/splitEngine.ts";

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
console.log("GlobeTrotter — Group Trip Split Engine Verification Suite (10 Cases)");
console.log("=================================================================\n");

// -----------------------------------------------------------------------------
// Case 1: ₹100 Split Among 3 Members and Exact Total Preservation
// -----------------------------------------------------------------------------
console.log("Test 1: ₹100 Split Among 3 Members & Cent Preservation");
{
  const result = calculateEqualSplit(100, ["m1", "m2", "m3"]);
  assert(result.totalCents === 10000, "Total cents is 10,000 (₹100.00)");
  assert(result.totalAmount === 100, "Total amount is 100");
  assert(result.shares.length === 3, "Returns 3 participant shares");

  // Remainder cent distribution: 10000 % 3 = 1.
  // First participant receives 3334 cents (₹33.34), others receive 3333 cents (₹33.33).
  assert(result.shares[0].cents === 3334, "Participant 1 receives 3334 cents (₹33.34)");
  assert(result.shares[1].cents === 3333, "Participant 2 receives 3333 cents (₹33.33)");
  assert(result.shares[2].cents === 3333, "Participant 3 receives 3333 cents (₹33.33)");

  const sumCents = result.shares.reduce((sum, s) => sum + s.cents, 0);
  assert(sumCents === 10000, "Sum of split shares strictly equals 10,000 cents with zero penny loss");

  const sumAmounts = result.shares.reduce((sum, s) => sum + s.amount, 0);
  assert(Math.round(sumAmounts * 100) / 100 === 100, "Sum of decimal amounts equals exactly ₹100.00");
}

// -----------------------------------------------------------------------------
// Case 2: Equal Split With One Member and Invalid/Empty Input
// -----------------------------------------------------------------------------
console.log("\nTest 2: Single Member & Invalid / Empty Input Handling");
{
  // 1 member
  const single = calculateEqualSplit(50, ["m1"]);
  assert(single.shares.length === 1, "Single member split succeeds");
  assert(single.shares[0].amount === 50, "Single member pays entire ₹50");

  // Empty member list throws
  let threwEmpty = false;
  try {
    calculateEqualSplit(100, []);
  } catch (err) {
    threwEmpty = true;
    assert(err.message.includes("cannot be empty"), "Empty participant list throws descriptive error");
  }
  assert(threwEmpty, "Empty member list rejected");

  // Zero or negative amount throws
  let threwZero = false;
  try {
    calculateEqualSplit(0, ["m1"]);
  } catch (err) {
    threwZero = true;
    assert(err.message.includes("greater than zero"), "Zero amount throws descriptive error");
  }
  assert(threwZero, "Zero amount rejected");

  let threwNegative = false;
  try {
    calculateEqualSplit(-25, ["m1"]);
  } catch (err) {
    threwNegative = true;
    assert(err.message.includes("greater than zero"), "Negative amount throws descriptive error");
  }
  assert(threwNegative, "Negative amount rejected");

  // Duplicate member IDs throws
  let threwDuplicate = false;
  try {
    calculateEqualSplit(60, ["m1", "m2", "m1"]);
  } catch (err) {
    threwDuplicate = true;
    assert(err.message.includes("Duplicate member IDs"), "Duplicate member IDs rejected with descriptive error");
  }
  assert(threwDuplicate, "Duplicate member IDs rejected");
}

// -----------------------------------------------------------------------------
// Case 3: Net Balances for a Shared Expense Paid by One Member
// -----------------------------------------------------------------------------
console.log("\nTest 3: Net Balances for Single Shared Expense");
{
  const members = [
    { id: "alice", display_name: "Alice", role: "owner" },
    { id: "bob", display_name: "Bob", role: "member" },
    { id: "charlie", display_name: "Charlie", role: "member" },
  ];

  // Alice pays ₹90 for Dinner, split equally among Alice, Bob, Charlie (₹30 each)
  const expenses = [
    { id: "exp-1", title: "Dinner", amount: 90, currency: "INR", paid_by_member_id: "alice" },
  ];
  const splits = [
    { expense_id: "exp-1", member_id: "alice", amount: 30 },
    { expense_id: "exp-1", member_id: "bob", amount: 30 },
    { expense_id: "exp-1", member_id: "charlie", amount: 30 },
  ];

  const result = computeGroupBalances({ members, expenses, splits });
  const report = result.reportsByCurrency["INR"];

  assert(report !== undefined, "INR currency report generated");
  assert(report.totalExpensesAmount === 90, "Total expenses is ₹90");

  const aliceBal = report.balancesByMemberId["alice"];
  const bobBal = report.balancesByMemberId["bob"];
  const charlieBal = report.balancesByMemberId["charlie"];

  assert(aliceBal.paidAmount === 90, "Alice paid ₹90");
  assert(aliceBal.shareAmount === 30, "Alice share is ₹30");
  assert(aliceBal.netBalance === 60, "Alice net balance is +₹60 (gets back ₹60)");

  assert(bobBal.paidAmount === 0, "Bob paid ₹0");
  assert(bobBal.shareAmount === 30, "Bob share is ₹30");
  assert(bobBal.netBalance === -30, "Bob net balance is -₹30 (owes ₹30)");

  assert(charlieBal.paidAmount === 0, "Charlie paid ₹0");
  assert(charlieBal.shareAmount === 30, "Charlie share is ₹30");
  assert(charlieBal.netBalance === -30, "Charlie net balance is -₹30 (owes ₹30)");
}

// -----------------------------------------------------------------------------
// Case 4: Net Balances Sum to Zero for Fully Split Expenses
// -----------------------------------------------------------------------------
console.log("\nTest 4: Conservation of Balances (Net Sum === 0)");
{
  const members = [
    { id: "m1", display_name: "Member 1", role: "owner" },
    { id: "m2", display_name: "Member 2", role: "member" },
    { id: "m3", display_name: "Member 3", role: "member" },
    { id: "m4", display_name: "Member 4", role: "member" },
  ];

  // ₹100 split 3 ways, ₹50 split 4 ways, ₹80 split 2 ways
  const split1 = calculateEqualSplit(100, ["m1", "m2", "m3"]);
  const split2 = calculateEqualSplit(50, ["m1", "m2", "m3", "m4"]);
  const split3 = calculateEqualSplit(80, ["m2", "m4"]);

  const expenses = [
    { id: "e1", title: "Cab", amount: 100, currency: "USD", paid_by_member_id: "m1" },
    { id: "e2", title: "Lunch", amount: 50, currency: "USD", paid_by_member_id: "m2" },
    { id: "e3", title: "Museum", amount: 80, currency: "USD", paid_by_member_id: "m4" },
  ];

  const splits = [
    ...split1.shares.map((s) => ({ expense_id: "e1", member_id: s.memberId, amount: s.amount })),
    ...split2.shares.map((s) => ({ expense_id: "e2", member_id: s.memberId, amount: s.amount })),
    ...split3.shares.map((s) => ({ expense_id: "e3", member_id: s.memberId, amount: s.amount })),
  ];

  const result = computeGroupBalances({ members, expenses, splits });
  const usdReport = result.reportsByCurrency["USD"];

  assert(usdReport.isBalanced === true, "Ledger is marked balanced");
  assert(usdReport.netDiscrepancyCents === 0, "Net discrepancy is exactly 0 cents");

  const totalNet = usdReport.memberBalances.reduce((sum, b) => sum + b.netBalance, 0);
  assert(Math.abs(totalNet) < 0.0001, "Sum of all member net balances is strictly 0.00");
}

// -----------------------------------------------------------------------------
// Case 5: Multiple Currencies Remain Strictly Isolated
// -----------------------------------------------------------------------------
console.log("\nTest 5: Strict Multi-Currency Isolation");
{
  const members = [
    { id: "alice", display_name: "Alice", role: "owner" },
    { id: "bob", display_name: "Bob", role: "member" },
  ];

  const expenses = [
    // INR Expense: Alice pays ₹600 for Alice & Bob (₹300 each)
    { id: "e-inr", title: "Train in India", amount: 600, currency: "INR", paid_by_member_id: "alice" },
    // USD Expense: Bob pays $50 for Alice & Bob ($25 each)
    { id: "e-usd", title: "US Visa photo", amount: 50, currency: "USD", paid_by_member_id: "bob" },
  ];

  const splits = [
    { expense_id: "e-inr", member_id: "alice", amount: 300 },
    { expense_id: "e-inr", member_id: "bob", amount: 300 },
    { expense_id: "e-usd", member_id: "alice", amount: 25 },
    { expense_id: "e-usd", member_id: "bob", amount: 25 },
  ];

  const result = computeGroupBalances({ members, expenses, splits });

  assert(result.currencies.length === 2, "Identified exactly 2 independent currencies");
  assert(result.currencies.includes("INR") && result.currencies.includes("USD"), "Contains INR and USD");

  // INR report
  const inrReport = result.reportsByCurrency["INR"];
  assert(inrReport.totalExpensesAmount === 600, "INR total is ₹600");
  assert(inrReport.balancesByMemberId["alice"].netBalance === 300, "Alice is owed ₹300 INR");
  assert(inrReport.balancesByMemberId["bob"].netBalance === -300, "Bob owes ₹300 INR");
  assert(inrReport.settlements.length === 1, "One INR settlement transaction");
  assert(
    inrReport.settlements[0].fromMemberId === "bob" &&
      inrReport.settlements[0].toMemberId === "alice" &&
      inrReport.settlements[0].amount === 300 &&
      inrReport.settlements[0].currency === "INR",
    "INR settlement: Bob pays Alice ₹300 INR"
  );

  // USD report
  const usdReport = result.reportsByCurrency["USD"];
  assert(usdReport.totalExpensesAmount === 50, "USD total is $50");
  assert(usdReport.balancesByMemberId["bob"].netBalance === 25, "Bob is owed $25 USD");
  assert(usdReport.balancesByMemberId["alice"].netBalance === -25, "Alice owes $25 USD");
  assert(usdReport.settlements.length === 1, "One USD settlement transaction");
  assert(
    usdReport.settlements[0].fromMemberId === "alice" &&
      usdReport.settlements[0].toMemberId === "bob" &&
      usdReport.settlements[0].amount === 25 &&
      usdReport.settlements[0].currency === "USD",
    "USD settlement: Alice pays Bob $25 USD"
  );

  // Assert no cross-currency settlement exists
  assert(
    inrReport.settlements.every((s) => s.currency === "INR"),
    "All INR settlements strictly in INR"
  );
  assert(
    usdReport.settlements.every((s) => s.currency === "USD"),
    "All USD settlements strictly in USD"
  );
}

// -----------------------------------------------------------------------------
// Case 6: Mutual Debt Cancellation
// -----------------------------------------------------------------------------
console.log("\nTest 6: Mutual Debt Cancellation Between Two Parties");
{
  const members = [
    { id: "a", display_name: "Alice", role: "owner" },
    { id: "b", display_name: "Bob", role: "member" },
  ];

  // Expense 1: Alice pays ₹60 for A & B (Bob owes Alice ₹30)
  // Expense 2: Bob pays ₹40 for A & B (Alice owes Bob ₹20)
  const expenses = [
    { id: "e1", title: "Breakfast", amount: 60, currency: "INR", paid_by_member_id: "a" },
    { id: "e2", title: "Coffee", amount: 40, currency: "INR", paid_by_member_id: "b" },
  ];
  const splits = [
    { expense_id: "e1", member_id: "a", amount: 30 },
    { expense_id: "e1", member_id: "b", amount: 30 },
    { expense_id: "e2", member_id: "a", amount: 20 },
    { expense_id: "e2", member_id: "b", amount: 20 },
  ];

  const result = computeGroupBalances({ members, expenses, splits });
  const report = result.reportsByCurrency["INR"];

  // Alice: paid 60, share 50 -> net +10
  // Bob: paid 40, share 50 -> net -10
  assert(report.balancesByMemberId["a"].netBalance === 10, "Alice net balance is +₹10");
  assert(report.balancesByMemberId["b"].netBalance === -10, "Bob net balance is -₹10");

  // Single settlement transaction: Bob pays Alice ₹10
  assert(report.settlements.length === 1, "Redundant mutual debts cancelled to 1 transaction");
  assert(
    report.settlements[0].fromMemberId === "b" &&
      report.settlements[0].toMemberId === "a" &&
      report.settlements[0].amount === 10,
    "Bob pays Alice ₹10 directly"
  );
}

// -----------------------------------------------------------------------------
// Case 7: Settlement Chain Simplification (A owes B ₹50, B owes C ₹50)
// -----------------------------------------------------------------------------
console.log("\nTest 7: Settlement Chain Simplification (A -> B -> C becomes A -> C)");
{
  const members = [
    { id: "a", display_name: "Alice", role: "owner" },
    { id: "b", display_name: "Bob", role: "member" },
    { id: "c", display_name: "Charlie", role: "member" },
  ];

  // Expense 1: Bob pays ₹100 split A & B (A owes B ₹50)
  // Expense 2: Charlie pays ₹100 split B & C (B owes C ₹50)
  const expenses = [
    { id: "e1", title: "Museum", amount: 100, currency: "INR", paid_by_member_id: "b" },
    { id: "e2", title: "Taxi", amount: 100, currency: "INR", paid_by_member_id: "c" },
  ];
  const splits = [
    { expense_id: "e1", member_id: "a", amount: 50 },
    { expense_id: "e1", member_id: "b", amount: 50 },
    { expense_id: "e2", member_id: "b", amount: 50 },
    { expense_id: "e2", member_id: "c", amount: 50 },
  ];

  const result = computeGroupBalances({ members, expenses, splits });
  const report = result.reportsByCurrency["INR"];

  // Alice: paid 0, share 50 -> net -50
  // Bob: paid 100, share 100 -> net 0 (settled!)
  // Charlie: paid 100, share 50 -> net +50
  assert(report.balancesByMemberId["a"].netBalance === -50, "Alice owes ₹50");
  assert(report.balancesByMemberId["b"].netBalance === 0, "Bob has net ₹0 (fully balanced)");
  assert(report.balancesByMemberId["c"].netBalance === 50, "Charlie is owed ₹50");

  // Greedy settlement directly routes payment from Alice to Charlie:
  assert(report.settlements.length === 1, "Only 1 transaction needed instead of 2");
  assert(
    report.settlements[0].fromMemberId === "a" &&
      report.settlements[0].toMemberId === "c" &&
      report.settlements[0].amount === 50,
    "Alice pays Charlie ₹50 directly (Bob bypassed as intermediary)"
  );
}

// -----------------------------------------------------------------------------
// Case 8: Missing/Unknown Member IDs and Incomplete Splits
// -----------------------------------------------------------------------------
console.log("\nTest 8: Missing / Unknown Member IDs & Incomplete Split Handling");
{
  const members = [
    { id: "alice", display_name: "Alice", role: "owner" },
    { id: "bob", display_name: "Bob", role: "member" },
  ];

  // 1. Split referencing unknown member
  const expUnknown = [
    { id: "e-unk", title: "Snack", amount: 40, currency: "USD", paid_by_member_id: "alice" },
  ];
  const splitsUnknown = [
    { expense_id: "e-unk", member_id: "alice", amount: 20 },
    { expense_id: "e-unk", member_id: "stranger-999", amount: 20 },
  ];

  const resUnknown = computeGroupBalances({ members, expenses: expUnknown, splits: splitsUnknown });
  assert(resUnknown.incompleteExpenses.length === 1, "Expense with stranger member flagged as incomplete");
  assert(
    resUnknown.validationErrors.some((err) => err.includes("unknown member ID")),
    "Validation error reported for unknown member"
  );
  assert(resUnknown.reportsByCurrency["USD"] === undefined, "Incomplete expense excluded from USD balances");

  // 2. Split sum not matching total expense
  const expMismatch = [
    { id: "e-mis", title: "Dinner", amount: 100, currency: "USD", paid_by_member_id: "alice" },
  ];
  const splitsMismatch = [
    { expense_id: "e-mis", member_id: "alice", amount: 40 },
    { expense_id: "e-mis", member_id: "bob", amount: 40 }, // total 80 instead of 100
  ];

  const resMismatch = computeGroupBalances({ members, expenses: expMismatch, splits: splitsMismatch });
  assert(resMismatch.incompleteExpenses.length === 1, "Mismatched split flagged as incomplete");
  assert(
    resMismatch.incompleteExpenses[0].reason.includes("does not equal expense total"),
    "Incomplete reason explains discrepancy"
  );
}

// -----------------------------------------------------------------------------
// Case 9: Legacy Unassigned Expenses
// -----------------------------------------------------------------------------
console.log("\nTest 9: Legacy Unassigned Expenses Isolation");
{
  const members = [
    { id: "alice", display_name: "Alice", role: "owner" },
    { id: "bob", display_name: "Bob", role: "member" },
  ];

  const expenses = [
    // Assigned expense: Alice paid ₹100 split equally
    { id: "e-assigned", title: "Hotel", amount: 100, currency: "INR", paid_by_member_id: "alice" },
    // Legacy expense: no paid_by_member_id
    { id: "e-legacy-1", title: "Old Flight", amount: 450, currency: "INR", paid_by_member_id: null },
    // Legacy expense: empty string paid_by
    { id: "e-legacy-2", title: "Old Metro", amount: 20, currency: "INR", paid_by_member_id: "" },
  ];

  const splits = [
    { expense_id: "e-assigned", member_id: "alice", amount: 50 },
    { expense_id: "e-assigned", member_id: "bob", amount: 50 },
  ];

  const result = computeGroupBalances({ members, expenses, splits });

  assert(result.unassignedExpenses.length === 2, "Identified both legacy unassigned expenses");
  assert(
    result.unassignedExpenses.some((e) => e.id === "e-legacy-1") &&
      result.unassignedExpenses.some((e) => e.id === "e-legacy-2"),
    "Both legacy expenses isolated"
  );

  const inrReport = result.reportsByCurrency["INR"];
  // Only the assigned expense is in active balances (₹100)
  assert(inrReport.totalExpensesAmount === 100, "Active expenses only sum assigned records (₹100, not ₹570)");
  assert(inrReport.balancesByMemberId["alice"].netBalance === 50, "Alice balance unaffected by legacy expenses");
  assert(inrReport.balancesByMemberId["bob"].netBalance === -50, "Bob balance unaffected by legacy expenses");
}

// -----------------------------------------------------------------------------
// Case 10: Deterministic Output and Rounding
// -----------------------------------------------------------------------------
console.log("\nTest 10: Determinism Across Repeated Executions");
{
  const members = [
    { id: "charlie", display_name: "Charlie", role: "member" },
    { id: "alice", display_name: "Alice", role: "owner" },
    { id: "bob", display_name: "Bob", role: "member" },
  ];

  const expenses = [
    { id: "e1", title: "Dinner", amount: 100, currency: "INR", paid_by_member_id: "alice" },
    { id: "e2", title: "Cab", amount: 70, currency: "INR", paid_by_member_id: "bob" },
  ];

  const split1 = calculateEqualSplit(100, ["alice", "bob", "charlie"]);
  const split2 = calculateEqualSplit(70, ["alice", "bob", "charlie"]);

  const splits = [
    ...split1.shares.map((s) => ({ expense_id: "e1", member_id: s.memberId, amount: s.amount })),
    ...split2.shares.map((s) => ({ expense_id: "e2", member_id: s.memberId, amount: s.amount })),
  ];

  const firstRun = computeGroupBalances({ members, expenses, splits });
  const firstJson = JSON.stringify(firstRun);

  let allIdentical = true;
  for (let i = 0; i < 20; i++) {
    const run = computeGroupBalances({ members, expenses, splits });
    if (JSON.stringify(run) !== firstJson) {
      allIdentical = false;
      break;
    }
  }

  assert(allIdentical, "20 repeated executions produced byte-for-byte identical output");
  assert(firstRun.reportsByCurrency["INR"].isBalanced === true, "Report is balanced");
  assert(firstRun.reportsByCurrency["INR"].settlements.length > 0, "Settlements produced deterministically");
}

console.log("\n=================================================================");
console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("=================================================================");

if (failedCount > 0) {
  process.exit(1);
}

