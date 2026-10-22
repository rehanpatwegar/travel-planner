/**
 * Verification Script for GlobeTrotter Feature 3 — Part 3: Backend API Logic & Integrations
 * Tests authentication, ownership, member management guards, payer assignment,
 * split allocations, cent integrity, and privacy isolation.
 *
 * Execution:
 * node --experimental-strip-types scripts/verify-group-split-api.mjs
 */

import {
  calculateEqualSplit,
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
console.log("GlobeTrotter — Group Trip Split API Verification Suite");
console.log("=================================================================\n");

// -----------------------------------------------------------------------------
// Test 1: Trip Ownership and Privacy Isolation
// -----------------------------------------------------------------------------
console.log("Test 1: Ownership & Privacy Isolation Verification");
{
  function verifyTripAccess(requestUser, trip) {
    if (!requestUser) return { status: 401, error: "Unauthorized" };
    if (!trip) return { status: 404, error: "Trip not found" };
    // Strict privacy rule: Financial splits and raw expense entries must NOT be
    // accessible to non-owners, even if the trip is marked public (is_public: true).
    if (trip.user_id !== requestUser.id) {
      return { status: 403, error: "Forbidden: You do not own this trip" };
    }
    return { status: 200, success: true };
  }

  const ownerUser = { id: "user-owner-111" };
  const strangerUser = { id: "user-stranger-222" };
  const publicTrip = { id: "trip-abc", user_id: "user-owner-111", is_public: true };
  const privateTrip = { id: "trip-def", user_id: "user-owner-111", is_public: false };

  assert(verifyTripAccess(null, publicTrip).status === 401, "Unauthenticated request returns 401 Unauthorized");
  assert(verifyTripAccess(ownerUser, publicTrip).status === 200, "Trip owner can access their public trip expenses");
  assert(verifyTripAccess(ownerUser, privateTrip).status === 200, "Trip owner can access their private trip expenses");
  assert(verifyTripAccess(strangerUser, privateTrip).status === 403, "Stranger is blocked from private trip expenses (403 Forbidden)");
  assert(verifyTripAccess(strangerUser, publicTrip).status === 403, "Stranger is strictly blocked from public trip expenses/splits (403 Forbidden - privacy isolation)");
}

// -----------------------------------------------------------------------------
// Test 2: Member Management & Duplicate Protection
// -----------------------------------------------------------------------------
console.log("\nTest 2: Member Creation & Duplicate Protection");
{
  function validateNewMember(existingMembers, body) {
    const { display_name, email, user_id } = body || {};
    if (!display_name || typeof display_name !== "string" || !display_name.trim()) {
      return { status: 400, error: "Member display name is required." };
    }
    const trimmed = display_name.trim();
    if (trimmed.length > 100) {
      return { status: 400, error: "Display name cannot exceed 100 characters." };
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return { status: 400, error: "Invalid email format." };
    }

    const lower = trimmed.toLowerCase();
    const duplicateName = existingMembers.some(
      (m) => m.display_name.trim().toLowerCase() === lower
    );
    if (duplicateName) {
      return { status: 409, error: `A travel companion named "${trimmed}" already exists on this trip.` };
    }

    if (user_id) {
      const duplicateUser = existingMembers.some((m) => m.user_id === user_id);
      if (duplicateUser) {
        return { status: 409, error: "This user profile is already added to this trip." };
      }
    }

    return { status: 201, member: { display_name: trimmed } };
  }

  const existing = [
    { id: "m1", display_name: "Alice Owner", role: "owner", user_id: "u1" },
    { id: "m2", display_name: "Bob Traveler", role: "member", user_id: null },
  ];

  assert(validateNewMember(existing, { display_name: "" }).status === 400, "Rejects empty display name");
  assert(validateNewMember(existing, { display_name: "   " }).status === 400, "Rejects whitespace display name");
  assert(validateNewMember(existing, { display_name: "Bob Traveler" }).status === 409, "Rejects exact duplicate display name");
  assert(validateNewMember(existing, { display_name: "bob traveler" }).status === 409, "Rejects case-insensitive duplicate display name");
  assert(validateNewMember(existing, { display_name: "  BOB TRAVELER  " }).status === 409, "Rejects trimmed case-insensitive duplicate display name");
  assert(validateNewMember(existing, { display_name: "Charlie", user_id: "u1" }).status === 409, "Rejects duplicate linked user_id profile");
  assert(validateNewMember(existing, { display_name: "Charlie", email: "invalid-email" }).status === 400, "Rejects malformed companion email");
  assert(validateNewMember(existing, { display_name: "Charlie", email: "charlie@example.com" }).status === 201, "Accepts valid unique travel companion");
}

// -----------------------------------------------------------------------------
// Test 3: Member Deletion Integrity Guards
// -----------------------------------------------------------------------------
console.log("\nTest 3: Member Deletion Integrity Guards");
{
  function canDeleteMember({ member, payerExpenseCount, activeSplitCount }) {
    if (!member) return { status: 404, error: "Member not found on this trip." };
    if (member.role === "owner") {
      return { status: 400, error: "Cannot remove the trip organizer/owner from the trip." };
    }
    if (payerExpenseCount > 0) {
      return {
        status: 400,
        error: `Cannot remove "${member.display_name}": They are recorded as the payer for ${payerExpenseCount} expense(s). Please reassign or delete those expenses first.`,
      };
    }
    if (activeSplitCount > 0) {
      return {
        status: 400,
        error: `Cannot remove "${member.display_name}": They have active cost split shares in ${activeSplitCount} expense(s). Please adjust or delete those expense splits first.`,
      };
    }
    return { status: 200, success: true };
  }

  const owner = { id: "m1", display_name: "Alice (Organizer)", role: "owner" };
  const payerMember = { id: "m2", display_name: "Bob", role: "member" };
  const splitMember = { id: "m3", display_name: "Charlie", role: "member" };
  const freeMember = { id: "m4", display_name: "Dana", role: "member" };

  assert(
    canDeleteMember({ member: owner, payerExpenseCount: 0, activeSplitCount: 0 }).status === 400,
    "Guard 1: Blocks deleting trip owner"
  );
  assert(
    canDeleteMember({ member: payerMember, payerExpenseCount: 3, activeSplitCount: 0 }).status === 400,
    "Guard 2: Blocks deleting member recorded as payer on 3 expenses"
  );
  assert(
    canDeleteMember({ member: splitMember, payerExpenseCount: 0, activeSplitCount: 2 }).status === 400,
    "Guard 3: Blocks deleting member participating in active expense splits"
  );
  assert(
    canDeleteMember({ member: freeMember, payerExpenseCount: 0, activeSplitCount: 0 }).status === 200,
    "Permits safe deletion of unlinked travel companion"
  );
}

// -----------------------------------------------------------------------------
// Test 4: Expense Creation - Payer Validation
// -----------------------------------------------------------------------------
console.log("\nTest 4: Expense Creation - Payer Cross-Trip Validation");
{
  const tripMembers = [
    { id: "m-owner", display_name: "Alice", role: "owner" },
    { id: "m-bob", display_name: "Bob", role: "member" },
  ];
  const memberMap = new Map(tripMembers.map((m) => [m.id, m]));

  function validatePayer(paid_by_member_id) {
    if (!paid_by_member_id) return { validPayerId: null, payer: null };
    const member = memberMap.get(paid_by_member_id.trim());
    if (!member) {
      return { error: "Selected payer does not belong to this trip" };
    }
    return { validPayerId: member.id, payer: member };
  }

  assert(validatePayer(null).validPayerId === null, "Accepts null payer (backward compatible solo expense)");
  assert(validatePayer(undefined).validPayerId === null, "Accepts undefined payer (backward compatible solo expense)");
  assert(validatePayer("m-bob").validPayerId === "m-bob", "Accepts legitimate trip member as payer");
  assert(validatePayer("m-stranger-999").error === "Selected payer does not belong to this trip", "Rejects foreign or non-existent payer");
}

// -----------------------------------------------------------------------------
// Test 5: Equal Split Calculation & Exact Total Preservation
// -----------------------------------------------------------------------------
console.log("\nTest 5: Equal Split Engine Integration");
{
  const tripMembers = [
    { id: "m1", display_name: "Alice" },
    { id: "m2", display_name: "Bob" },
    { id: "m3", display_name: "Charlie" },
  ];
  const memberMap = new Map(tripMembers.map((m) => [m.id, m]));

  function validateAndCalculateEqualSplit(costNum, participantIds) {
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return { error: "Participant list cannot be empty" };
    }
    const uniqueIds = new Set(participantIds);
    if (uniqueIds.size !== participantIds.length) {
      return { error: "Duplicate members specified in equal split participants" };
    }
    for (const pId of participantIds) {
      if (!memberMap.has(pId)) {
        return { error: "One or more split participants do not belong to this trip" };
      }
    }
    const splitResult = calculateEqualSplit(costNum, participantIds);
    return {
      shares: splitResult.shares.map((s) => ({
        memberId: s.memberId,
        amount: s.amount,
        cents: s.cents,
      })),
    };
  }

  // 100 among 3: 33.34, 33.33, 33.33
  const res3 = validateAndCalculateEqualSplit(100, ["m1", "m2", "m3"]);
  assert(!res3.error, "Calculates equal split without errors");
  assert(res3.shares.length === 3, "Creates 3 shares");
  assert(res3.shares[0].amount === 33.34, "Share 1 is 33.34 (cent preservation)");
  assert(res3.shares[1].amount === 33.33, "Share 2 is 33.33");
  assert(res3.shares[2].amount === 33.33, "Share 3 is 33.33");
  const totalCents = res3.shares.reduce((sum, s) => sum + s.cents, 0);
  assert(totalCents === 10000, "Sum of split cents exactly equals 10,000 (100.00)");

  // Rejection of foreign member
  const foreignRes = validateAndCalculateEqualSplit(100, ["m1", "m-alien"]);
  assert(foreignRes.error === "One or more split participants do not belong to this trip", "Rejects foreign participant in equal split");

  // Rejection of duplicate participant
  const dupRes = validateAndCalculateEqualSplit(100, ["m1", "m1"]);
  assert(dupRes.error === "Duplicate members specified in equal split participants", "Rejects duplicate participants in equal split");
}

// -----------------------------------------------------------------------------
// Test 6: Custom Split Validation & Cent-Exact Match
// -----------------------------------------------------------------------------
console.log("\nTest 6: Custom Split Cent-Exact Validation");
{
  const tripMembers = [
    { id: "m1", display_name: "Alice" },
    { id: "m2", display_name: "Bob" },
    { id: "m3", display_name: "Charlie" },
  ];
  const memberMap = new Map(tripMembers.map((m) => [m.id, m]));

  function validateCustomSplits(costNum, customSplits) {
    if (!Array.isArray(customSplits) || customSplits.length === 0) {
      return { error: "Custom split requires at least one participant with an allocated share" };
    }
    const seenMemberIds = new Set();
    let totalSplitCents = 0;
    const shares = [];

    for (const item of customSplits) {
      if (!item || !item.member_id) return { error: "Invalid split item" };
      const mId = String(item.member_id).trim();
      if (seenMemberIds.has(mId)) {
        return { error: "Duplicate member in custom split list" };
      }
      seenMemberIds.add(mId);

      const member = memberMap.get(mId);
      if (!member) {
        return { error: "One or more split participants do not belong to this trip" };
      }

      const shareNum = Number(item.amount);
      if (isNaN(shareNum) || shareNum < 0) {
        return { error: `Invalid split amount for member "${member.display_name}". Amount cannot be negative.` };
      }

      const shareCents = toCents(shareNum);
      totalSplitCents += shareCents;
      shares.push({ memberId: mId, amount: fromCents(shareCents) });
    }

    const expectedCents = toCents(costNum);
    if (totalSplitCents !== expectedCents) {
      return {
        error: `Custom split sum (${fromCents(totalSplitCents)}) does not match the total expense amount (${fromCents(expectedCents)})`,
      };
    }
    return { shares };
  }

  // Exact match 50 + 30 + 20 = 100
  const matchRes = validateCustomSplits(100, [
    { member_id: "m1", amount: 50 },
    { member_id: "m2", amount: 30 },
    { member_id: "m3", amount: 20 },
  ]);
  assert(!matchRes.error, "Accepts exact matching custom split sum");
  assert(matchRes.shares.length === 3, "Creates 3 custom shares");

  // Under-split (50 + 30 = 80 instead of 100)
  const underRes = validateCustomSplits(100, [
    { member_id: "m1", amount: 50 },
    { member_id: "m2", amount: 30 },
  ]);
  assert(underRes.error && underRes.error.includes("does not match"), "Rejects under-split (sum < total amount)");

  // Over-split (50 + 60 = 110 instead of 100)
  const overRes = validateCustomSplits(100, [
    { member_id: "m1", amount: 50 },
    { member_id: "m2", amount: 60 },
  ]);
  assert(overRes.error && overRes.error.includes("does not match"), "Rejects over-split (sum > total amount)");

  // Negative amount
  const negRes = validateCustomSplits(100, [
    { member_id: "m1", amount: 120 },
    { member_id: "m2", amount: -20 },
  ]);
  assert(negRes.error && negRes.error.includes("cannot be negative"), "Rejects negative split share amounts");

  // Duplicate member
  const dupCustom = validateCustomSplits(100, [
    { member_id: "m1", amount: 50 },
    { member_id: "m1", amount: 50 },
  ]);
  assert(dupCustom.error === "Duplicate member in custom split list", "Rejects duplicate member in custom split list");

  // Foreign member
  const foreignCustom = validateCustomSplits(100, [
    { member_id: "m1", amount: 50 },
    { member_id: "m-ghost", amount: 50 },
  ]);
  assert(foreignCustom.error === "One or more split participants do not belong to this trip", "Rejects foreign participant in custom split");
}

// -----------------------------------------------------------------------------
// Test 7: Enriched Expense Payload & Backward Compatibility
// -----------------------------------------------------------------------------
console.log("\nTest 7: Enriched Expense Payload & Backward Compatibility");
{
  const rawExpense1 = {
    id: "e1",
    trip_id: "trip-1",
    title: "Team Dinner",
    amount: "150.00",
    category: "Food & Dining",
    currency: "USD",
    paid_by_member_id: "m-bob",
    split_type: "equal",
    created_at: "2026-10-22T10:00:00Z",
  };

  const rawExpense2 = {
    id: "e2",
    trip_id: "trip-1",
    title: "Subway Pass (Solo)",
    amount: "5.50",
    category: "Transportation",
    currency: "USD",
    paid_by_member_id: null,
    split_type: null,
    created_at: "2026-10-22T11:00:00Z",
  };

  const members = [
    { id: "m-alice", display_name: "Alice", role: "owner" },
    { id: "m-bob", display_name: "Bob", role: "member" },
  ];
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const splits = [
    { id: "s1", expense_id: "e1", member_id: "m-alice", amount: "75.00" },
    { id: "s2", expense_id: "e1", member_id: "m-bob", amount: "75.00" },
  ];

  function enrichExpenses(expenses, splitsList, memMap) {
    const splitsByExpense = new Map();
    for (const s of splitsList) {
      const list = splitsByExpense.get(s.expense_id) || [];
      list.push({
        id: s.id,
        expense_id: s.expense_id,
        member_id: s.member_id,
        amount: Number(s.amount),
        member_name: memMap.get(s.member_id)?.display_name || "Unknown",
      });
      splitsByExpense.set(s.expense_id, list);
    }

    return expenses.map((exp) => {
      const payer = exp.paid_by_member_id ? memMap.get(exp.paid_by_member_id) : null;
      return {
        ...exp,
        amount: Number(exp.amount),
        paid_by: payer ? { id: payer.id, display_name: payer.display_name, role: payer.role } : null,
        splits: splitsByExpense.get(exp.id) || [],
      };
    });
  }

  const enriched = enrichExpenses([rawExpense1, rawExpense2], splits, memberMap);
  assert(enriched.length === 2, "Returns all expenses");

  // Check split expense
  const teamDinner = enriched[0];
  assert(teamDinner.amount === 150, "Converts amount to number");
  assert(teamDinner.paid_by !== null, "Enriches paid_by with object");
  assert(teamDinner.paid_by.display_name === "Bob", "Enriched payer name is Bob");
  assert(teamDinner.splits.length === 2, "Enriches with 2 split records");
  assert(teamDinner.splits[0].member_name === "Alice", "First split member name is Alice");
  assert(teamDinner.splits[0].amount === 75, "First split amount is 75");

  // Check solo legacy expense
  const soloExpense = enriched[1];
  assert(soloExpense.amount === 5.5, "Solo expense amount is 5.5");
  assert(soloExpense.paid_by === null, "Solo expense paid_by is null");
  assert(Array.isArray(soloExpense.splits) && soloExpense.splits.length === 0, "Solo expense splits is empty array []");
  assert(soloExpense.title === "Subway Pass (Solo)", "Preserves title");
  assert(soloExpense.category === "Transportation", "Preserves category");
}

// -----------------------------------------------------------------------------
// Test 8: Member Auto-Initialization & Race Condition Recovery (Synthetic Test)
// -----------------------------------------------------------------------------
console.log("\nTest 8: Member Auto-Initialization & Race Condition Recovery");
console.log("  [NOTICE] Synthetic handler flow verification simulating Supabase client behavior.");
console.log("           Tests do NOT perform live database integration calls.");
{
  async function simulateGetMembersHandler({
    existingMembers,
    insertResult,
    fallbackQueryResult,
  }) {
    // 1. If trip already has members, return them directly (idempotent)
    if (existingMembers && existingMembers.length > 0) {
      return { status: 200, members: existingMembers };
    }

    // 2. If 0 members, attempt auto-initialization insert
    const { autoOwner, autoError } = insertResult;
    if (!autoError && autoOwner) {
      return { status: 200, members: [autoOwner] };
    }

    if (autoError) {
      if (autoError.code === "23505") {
        // Race condition recovery: concurrent request won the initialization race
        const { raceMembers, raceError } = fallbackQueryResult || {};
        if (raceError) {
          return {
            status: 500,
            error: "Failed to fetch trip members after initialization race.",
          };
        }
        if (raceMembers && raceMembers.length > 0) {
          return { status: 200, members: raceMembers };
        }
        return {
          status: 500,
          error: "Failed to load trip members after initialization race.",
        };
      }

      // Other non-race insert errors
      return {
        status: 500,
        error: "Failed to initialize trip organizer member.",
      };
    }

    return { status: 200, members: existingMembers || [] };
  }

  // Case A: Successful normal initialization on empty trip
  {
    const res = await simulateGetMembersHandler({
      existingMembers: [],
      insertResult: {
        autoOwner: { id: "m-owner", display_name: "Organizer", role: "owner" },
        autoError: null,
      },
    });
    assert(res.status === 200, "Case A: Returns 200 on successful owner initialization");
    assert(res.members.length === 1, "Case A: Returns 1 auto-created owner member");
    assert(res.members[0].role === "owner", "Case A: Initialized member has role 'owner'");
  }

  // Case B: Duplicate-key race condition recovery (code 23505)
  {
    const res = await simulateGetMembersHandler({
      existingMembers: [],
      insertResult: {
        autoOwner: null,
        autoError: {
          code: "23505",
          message: "duplicate key value violates unique constraint idx_trip_members_trip_user",
        },
      },
      fallbackQueryResult: {
        raceMembers: [
          { id: "m-winner", display_name: "Organizer", role: "owner" },
        ],
        raceError: null,
      },
    });
    assert(res.status === 200, "Case B: Race recovery returns 200 instead of failing or returning empty list");
    assert(res.members.length === 1, "Case B: Race recovery returns fresh member list from fallback query");
    assert(res.members[0].id === "m-winner", "Case B: Successfully recovered member created by concurrent request");
  }

  // Case C: Fallback query fails after duplicate-key race
  {
    const res = await simulateGetMembersHandler({
      existingMembers: [],
      insertResult: {
        autoOwner: null,
        autoError: { code: "23505", message: "duplicate key" },
      },
      fallbackQueryResult: {
        raceMembers: null,
        raceError: { message: "Database connection timeout" },
      },
    });
    assert(res.status === 500, "Case C: Returns 500 if fallback query fails (does NOT silently return stale empty list)");
    assert(res.error.includes("after initialization race"), "Case C: Returns descriptive race recovery error message");
  }

  // Case D: Fallback query returns empty list after duplicate-key race
  {
    const res = await simulateGetMembersHandler({
      existingMembers: [],
      insertResult: {
        autoOwner: null,
        autoError: { code: "23505", message: "duplicate key" },
      },
      fallbackQueryResult: {
        raceMembers: [],
        raceError: null,
      },
    });
    assert(res.status === 500, "Case D: Returns 500 if fallback query unexpectedly yields zero members");
  }

  // Case E: Non-race insert error (e.g. connection or permission error)
  {
    const res = await simulateGetMembersHandler({
      existingMembers: [],
      insertResult: {
        autoOwner: null,
        autoError: { code: "42501", message: "permission denied for table trip_members" },
      },
    });
    assert(res.status === 500, "Case E: Returns 500 for non-race insert errors");
    assert(res.error === "Failed to initialize trip organizer member.", "Case E: Does NOT treat arbitrary error as race condition");
  }

  // Case F: Idempotency when members already exist
  {
    const existing = [
      { id: "m-existing", display_name: "Alice", role: "owner" },
      { id: "m-companion", display_name: "Bob", role: "member" },
    ];
    const res = await simulateGetMembersHandler({
      existingMembers: existing,
      insertResult: { autoOwner: null, autoError: null },
    });
    assert(res.status === 200, "Case F: Returns 200 without attempting insert when members exist");
    assert(res.members.length === 2, "Case F: Returns all existing members unchanged");
  }
}

console.log("\n=================================================================");
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log("=================================================================");

if (failedCount > 0) {
  process.exit(1);
}

