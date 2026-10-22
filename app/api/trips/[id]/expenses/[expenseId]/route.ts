import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/trips/[id]/expenses/[expenseId]
 * Fetches a single expense with its payer and split shares.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id: tripId, expenseId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify trip ownership strictly
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id")
      .eq("id", tripId)
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

    // Fetch the target expense
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", expenseId)
      .eq("trip_id", tripId)
      .maybeSingle();

    if (expenseError || !expense) {
      return NextResponse.json(
        { error: "Expense not found on this trip" },
        { status: 404 }
      );
    }

    // Fetch members and splits
    const { data: members } = await supabase
      .from("trip_members")
      .select("id, display_name, role")
      .eq("trip_id", tripId);

    const memberMap = new Map((members || []).map((m) => [m.id, m]));

    const { data: splits } = await supabase
      .from("expense_splits")
      .select("id, expense_id, member_id, amount, created_at")
      .eq("expense_id", expenseId)
      .order("created_at", { ascending: true });

    const payer = expense.paid_by_member_id
      ? memberMap.get(expense.paid_by_member_id)
      : null;

    const enrichedExpense = {
      ...expense,
      amount: Number(expense.amount),
      paid_by: payer
        ? {
            id: payer.id,
            display_name: payer.display_name,
            role: payer.role,
          }
        : null,
      splits: (splits || []).map((s) => ({
        id: s.id,
        expense_id: s.expense_id,
        member_id: s.member_id,
        amount: Number(s.amount),
        member_name:
          memberMap.get(s.member_id)?.display_name || "Unknown Member",
      })),
    };

    return NextResponse.json({ expense: enrichedExpense });
  } catch (error) {
    console.error("Expense GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trips/[id]/expenses/[expenseId]
 * Deletes an expense from a trip.
 * Automatically cascades to delete any associated expense_splits.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id: tripId, expenseId } = await params;
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
      .select("id, user_id")
      .eq("id", tripId)
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

    // Verify expense exists on this trip
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .select("id, trip_id")
      .eq("id", expenseId)
      .eq("trip_id", tripId)
      .maybeSingle();

    if (expenseError || !expense) {
      return NextResponse.json(
        { error: "Expense not found on this trip" },
        { status: 404 }
      );
    }

    // Delete expense (foreign key cascade removes associated expense_splits)
    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId)
      .eq("trip_id", tripId);

    if (deleteError) {
      console.error("Failed to delete expense:", deleteError.message);
      return NextResponse.json(
        { error: "Failed to delete expense" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedId: expenseId,
    });
  } catch (error) {
    console.error("Expense DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
