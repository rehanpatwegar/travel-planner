import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateEqualSplit,
  toCents,
  fromCents,
  SplitType,
} from "@/lib/budget/splitEngine";

export const dynamic = "force-dynamic";

const VALID_EXPENSE_CATEGORIES = [
  "Accommodation",
  "Activities",
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Miscellaneous",
] as const;

/**
 * GET /api/trips/[id]/expenses
 * Retrieves all expenses for a trip, enriched with payer details and split allocations.
 * Strict ownership check: only the authenticated trip owner can access raw expenses
 * and private group member split data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify trip ownership strictly (do not leak private member balances/payers to public share visitors)
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, is_public")
      .eq("id", id)
      .maybeSingle();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view expenses for this trip" },
        { status: 403 }
      );
    }

    // Fetch expenses
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", id)
      .order("expense_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (expensesError) {
      console.error("Error fetching expenses:", expensesError.message);
      return NextResponse.json(
        { error: "Failed to fetch expenses" },
        { status: 500 }
      );
    }

    if (!expenses || expenses.length === 0) {
      return NextResponse.json({ expenses: [] });
    }

    // Fetch members for this trip to enrich payer and split info
    const { data: members, error: membersError } = await supabase
      .from("trip_members")
      .select("id, display_name, role, user_id")
      .eq("trip_id", id);

    if (membersError) {
      console.error("Error fetching trip members for expenses:", membersError.message);
    }

    const memberMap = new Map((members || []).map((m) => [m.id, m]));

    // Fetch all splits for these expenses
    const expenseIds = expenses.map((e) => e.id);
    const { data: splits, error: splitsError } = await supabase
      .from("expense_splits")
      .select("id, expense_id, member_id, amount, created_at")
      .in("expense_id", expenseIds)
      .order("created_at", { ascending: true });

    if (splitsError) {
      console.error("Error fetching expense splits:", splitsError.message);
    }

    const splitsByExpenseId = new Map<
      string,
      Array<{
        id: string;
        expense_id: string;
        member_id: string;
        amount: number;
        member_name: string;
      }>
    >();

    if (splits) {
      for (const s of splits) {
        const list = splitsByExpenseId.get(s.expense_id) || [];
        const member = memberMap.get(s.member_id);
        list.push({
          id: s.id,
          expense_id: s.expense_id,
          member_id: s.member_id,
          amount: Number(s.amount),
          member_name: member?.display_name || "Unknown Member",
        });
        splitsByExpenseId.set(s.expense_id, list);
      }
    }

    // Return enriched expenses
    const enrichedExpenses = expenses.map((exp) => {
      const payer = exp.paid_by_member_id
        ? memberMap.get(exp.paid_by_member_id)
        : null;
      const expenseSplits = splitsByExpenseId.get(exp.id) || [];

      return {
        ...exp,
        amount: Number(exp.amount),
        paid_by: payer
          ? {
              id: payer.id,
              display_name: payer.display_name,
              role: payer.role,
            }
          : null,
        splits: expenseSplits,
      };
    });

    return NextResponse.json({ expenses: enrichedExpenses });
  } catch (error) {
    console.error("Expenses GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips/[id]/expenses
 * Creates a new expense entry, optionally assigns a trip member as payer,
 * and creates equal or custom split share records.
 *
 * Guarantees:
 * - Verifies user owns the trip.
 * - Validates payer and all split participants belong to this exact trip.
 * - Uses pure split calculation engine for penny-exact equal division.
 * - Validates that custom splits match the exact cent total.
 * - Rollback cleanup: If writing splits fails, deletes the newly created expense
 *   to avoid orphan un-split records.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify trip ownership
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, currency")
      .eq("id", id)
      .maybeSingle();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this trip" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      title,
      amount,
      category,
      currency,
      expense_date,
      payment_method,
      notes,
      itinerary_item_id,
      paid_by_member_id,
      split_type,
      split_member_ids,
      custom_splits,
    } = body;

    // Validate title
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Expense title is required" },
        { status: 400 }
      );
    }

    // Validate amount
    const costNum = Number(amount);
    if (isNaN(costNum) || costNum < 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number or zero" },
        { status: 400 }
      );
    }

    if (costNum > 100000000) {
      return NextResponse.json(
        { error: "Amount exceeds maximum allowed limit" },
        { status: 400 }
      );
    }

    // Validate category
    if (!VALID_EXPENSE_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${VALID_EXPENSE_CATEGORIES.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    // Validate expense date
    let validDate: string | null = null;
    if (expense_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(expense_date) || isNaN(Date.parse(expense_date))) {
        return NextResponse.json(
          { error: "Invalid date format. Expected YYYY-MM-DD" },
          { status: 400 }
        );
      }
      validDate = expense_date;
    }

    // Validate optional itinerary item link
    let validItineraryItemId: string | null = null;
    if (
      itinerary_item_id &&
      typeof itinerary_item_id === "string" &&
      itinerary_item_id.trim()
    ) {
      const { data: itemData, error: itemError } = await supabase
        .from("itinerary_items")
        .select("id, trip_id")
        .eq("id", itinerary_item_id.trim())
        .eq("trip_id", id)
        .maybeSingle();

      if (itemError || !itemData) {
        return NextResponse.json(
          {
            error:
              "Invalid linked activity: Item does not belong to this trip",
          },
          { status: 400 }
        );
      }
      validItineraryItemId = itemData.id;
    }

    // Fetch members of this trip for relationship validation
    const { data: tripMembers, error: membersQueryError } = await supabase
      .from("trip_members")
      .select("id, display_name, role")
      .eq("trip_id", id);

    if (membersQueryError) {
      console.error(
        "Error fetching trip members for validation:",
        membersQueryError.message
      );
      return NextResponse.json(
        { error: "Failed to validate trip members" },
        { status: 500 }
      );
    }

    const tripMembersMap = new Map((tripMembers || []).map((m) => [m.id, m]));

    // Validate paid_by_member_id
    let validPaidByMemberId: string | null = null;
    let payerMember: { id: string; display_name: string; role: string } | null =
      null;

    if (
      paid_by_member_id &&
      typeof paid_by_member_id === "string" &&
      paid_by_member_id.trim()
    ) {
      const memberId = paid_by_member_id.trim();
      const member = tripMembersMap.get(memberId);
      if (!member) {
        return NextResponse.json(
          { error: "Selected payer does not belong to this trip" },
          { status: 400 }
        );
      }
      validPaidByMemberId = member.id;
      payerMember = member;
    }

    // Validate splits
    type CalculatedShare = {
      memberId: string;
      amount: number;
      memberName: string;
    };
    let calculatedShares: CalculatedShare[] = [];
    let resolvedSplitType: SplitType | null = null;

    if (
      split_type === "custom" ||
      (custom_splits && Array.isArray(custom_splits) && custom_splits.length > 0)
    ) {
      // Custom split branch
      if (!Array.isArray(custom_splits) || custom_splits.length === 0) {
        return NextResponse.json(
          {
            error:
              "Custom split requires at least one participant with an allocated share",
          },
          { status: 400 }
        );
      }

      const seenMemberIds = new Set<string>();
      let totalSplitCents = 0;
      const tempShares: CalculatedShare[] = [];

      for (const item of custom_splits) {
        if (
          !item ||
          typeof item !== "object" ||
          !item.member_id ||
          typeof item.member_id !== "string"
        ) {
          return NextResponse.json(
            { error: "Each custom split item must specify a valid member_id" },
            { status: 400 }
          );
        }

        const mId = item.member_id.trim();
        if (seenMemberIds.has(mId)) {
          return NextResponse.json(
            { error: "Duplicate member in custom split list" },
            { status: 400 }
          );
        }
        seenMemberIds.add(mId);

        const member = tripMembersMap.get(mId);
        if (!member) {
          return NextResponse.json(
            {
              error:
                "One or more split participants do not belong to this trip",
            },
            { status: 400 }
          );
        }

        const shareNum = Number(item.amount);
        if (isNaN(shareNum) || shareNum < 0) {
          return NextResponse.json(
            {
              error: `Invalid split amount for member "${member.display_name}". Amount cannot be negative.`,
            },
            { status: 400 }
          );
        }

        const shareCents = toCents(shareNum);
        totalSplitCents += shareCents;
        tempShares.push({
          memberId: mId,
          amount: fromCents(shareCents),
          memberName: member.display_name,
        });
      }

      const expectedCents = toCents(costNum);
      if (totalSplitCents !== expectedCents) {
        return NextResponse.json(
          {
            error: `Custom split sum (${fromCents(
              totalSplitCents
            )}) does not match the total expense amount (${fromCents(
              expectedCents
            )})`,
          },
          { status: 400 }
        );
      }

      calculatedShares = tempShares;
      resolvedSplitType = "custom";
    } else if (
      split_member_ids &&
      Array.isArray(split_member_ids) &&
      split_member_ids.length > 0
    ) {
      // Equal split branch using split calculation engine
      const memberIdList = split_member_ids.map((m: unknown) =>
        String(m).trim()
      );

      const uniqueMemberIds = new Set(memberIdList);
      if (uniqueMemberIds.size !== memberIdList.length) {
        return NextResponse.json(
          { error: "Duplicate members specified in equal split participants" },
          { status: 400 }
        );
      }

      for (const mId of memberIdList) {
        if (!tripMembersMap.has(mId)) {
          return NextResponse.json(
            {
              error:
                "One or more split participants do not belong to this trip",
            },
            { status: 400 }
          );
        }
      }

      try {
        const splitResult = calculateEqualSplit(costNum, memberIdList);
        calculatedShares = splitResult.shares.map((share) => ({
          memberId: share.memberId,
          amount: share.amount,
          memberName:
            tripMembersMap.get(share.memberId)?.display_name || "Unknown Member",
        }));
        resolvedSplitType = "equal";
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to calculate equal split";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const currencyCode =
      typeof currency === "string" && currency.trim()
        ? currency.trim().toUpperCase().slice(0, 3)
        : trip.currency || "USD";

    const insertPayload = {
      trip_id: id,
      itinerary_item_id: validItineraryItemId,
      title: title.trim(),
      amount: costNum,
      category,
      currency: currencyCode,
      expense_date: validDate,
      payment_method: payment_method ? String(payment_method).trim() : null,
      notes: notes ? String(notes).trim() : null,
      paid_by_member_id: validPaidByMemberId,
      split_type: resolvedSplitType,
    };

    const { data: newExpense, error: insertError } = await supabase
      .from("expenses")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !newExpense) {
      console.error("Failed to insert expense:", insertError?.message);
      return NextResponse.json(
        { error: "Failed to record expense" },
        { status: 500 }
      );
    }

    // Insert split records if split participants were specified
    let insertedSplits: Array<{
      id: string;
      expense_id: string;
      member_id: string;
      amount: number;
    }> = [];

    if (calculatedShares.length > 0) {
      const splitRows = calculatedShares.map((share) => ({
        expense_id: newExpense.id,
        member_id: share.memberId,
        amount: share.amount,
      }));

      const { data: splitsData, error: splitsInsertError } = await supabase
        .from("expense_splits")
        .insert(splitRows)
        .select("id, expense_id, member_id, amount");

      if (splitsInsertError) {
        console.error(
          "Failed to insert splits, rolling back expense:",
          splitsInsertError.message
        );
        // Compensating rollback cleanup
        await supabase.from("expenses").delete().eq("id", newExpense.id);
        return NextResponse.json(
          {
            error:
              "Failed to record expense splits. The expense was not saved.",
          },
          { status: 500 }
        );
      }

      insertedSplits = (splitsData || []).map((s) => ({
        ...s,
        amount: Number(s.amount),
      }));
    }

    const enrichedNewExpense = {
      ...newExpense,
      amount: Number(newExpense.amount),
      paid_by: payerMember
        ? {
            id: payerMember.id,
            display_name: payerMember.display_name,
            role: payerMember.role,
          }
        : null,
      splits: insertedSplits.map((s) => ({
        ...s,
        member_name:
          tripMembersMap.get(s.member_id)?.display_name || "Unknown Member",
      })),
    };

    return NextResponse.json({ expense: enrichedNewExpense }, { status: 201 });
  } catch (error) {
    console.error("Expenses POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
