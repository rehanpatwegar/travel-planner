import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_EXPENSE_CATEGORIES = [
  "Accommodation",
  "Activities",
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Miscellaneous",
] as const;

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

    // Verify trip ownership or public access
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, is_public")
      .eq("id", id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.user_id !== user.id && !trip.is_public) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    return NextResponse.json({ expenses: expenses || [] });
  } catch (error) {
    console.error("Expenses GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this trip" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      amount,
      category,
      currency,
      expense_date,
      payment_method,
      notes,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Expense title is required" },
        { status: 400 }
      );
    }

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

    const insertPayload = {
      trip_id: id,
      title: title.trim(),
      amount: costNum,
      category,
      currency: currency || trip.currency || "USD",
      expense_date: validDate,
      payment_method: payment_method ? String(payment_method).trim() : null,
      notes: notes ? String(notes).trim() : null,
    };

    const { data: newExpense, error: insertError } = await supabase
      .from("expenses")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      console.error("Failed to insert expense:", insertError.message);
      return NextResponse.json(
        { error: "Failed to record expense" },
        { status: 500 }
      );
    }

    return NextResponse.json({ expense: newExpense }, { status: 201 });
  } catch (error) {
    console.error("Expenses POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

