import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = [
  "Sightseeing",
  "Food & Dining",
  "Culture & History",
  "Adventure",
  "Nature",
  "Entertainment",
  "Shopping",
  "Relaxation",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: tripId, itemId } = await params;
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
      .single();

    if (tripError || !trip || trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden or Trip Not Found" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updatePayload: Record<string, any> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json(
          { error: "Title cannot be empty" },
          { status: 400 }
        );
      }
      updatePayload.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updatePayload.description = body.description ? String(body.description).trim() : null;
    }

    if (body.notes !== undefined) {
      updatePayload.notes = body.notes ? String(body.notes).trim() : null;
    }

    if (body.category !== undefined) {
      if (VALID_CATEGORIES.includes(body.category)) {
        updatePayload.category = body.category;
      }
    }

    if (body.estimated_cost !== undefined) {
      const cost = Number(body.estimated_cost);
      if (!isNaN(cost) && cost >= 0) {
        updatePayload.estimated_cost = cost;
      }
    }

    if (body.start_time !== undefined) {
      updatePayload.start_time = body.start_time || null;
    }

    if (body.end_time !== undefined) {
      updatePayload.end_time = body.end_time || null;
    }

    if (body.day_number !== undefined) {
      const day = Number(body.day_number);
      if (Number.isInteger(day) && day >= 1) {
        updatePayload.day_number = day;
      }
    }

    if (body.order_index !== undefined) {
      const order = Number(body.order_index);
      if (Number.isInteger(order) && order >= 0) {
        updatePayload.order_index = order;
      }
    }

    if (body.is_completed !== undefined) {
      updatePayload.is_completed = Boolean(body.is_completed);
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("itinerary_items")
      .update(updatePayload)
      .eq("id", itemId)
      .eq("trip_id", tripId)
      .select("*, activities(*)")
      .single();

    if (updateError) {
      console.error("Failed to update item:", updateError.message);
      return NextResponse.json(
        { error: "Failed to update item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: updatedItem });
  } catch (err) {
    console.error("Update item error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: tripId, itemId } = await params;
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
      .single();

    if (tripError || !trip || trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden or Trip Not Found" },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from("itinerary_items")
      .delete()
      .eq("id", itemId)
      .eq("trip_id", tripId);

    if (deleteError) {
      console.error("Failed to delete item:", deleteError.message);
      return NextResponse.json(
        { error: "Failed to delete item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedId: itemId });
  } catch (err) {
    console.error("Delete item error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

