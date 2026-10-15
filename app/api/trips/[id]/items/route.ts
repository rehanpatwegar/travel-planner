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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
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
      .eq("id", tripId)
      .single();

    if (tripError || !trip || trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden or Trip Not Found" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Support batch insertion when body.items array is provided
    if (Array.isArray(body.items)) {
      if (body.items.length === 0) {
        return NextResponse.json({ items: [] }, { status: 200 });
      }

      const insertBatch = body.items.map((item: any, idx: number) => {
        const dayNum = Number(item.day_number);
        const validDay = Number.isInteger(dayNum) && dayNum >= 1 ? dayNum : 1;
        const sanitizedCat = VALID_CATEGORIES.includes(item.category)
          ? item.category
          : "Sightseeing";
        const costNum = Number(item.estimated_cost);
        const validCost = isNaN(costNum) || costNum < 0 ? 0 : costNum;
        const orderIdx = Number(item.order_index);
        const validOrder = isNaN(orderIdx) || orderIdx < 0 ? idx : orderIdx;

        return {
          trip_id: tripId,
          title: String(item.title || "Curated Activity").trim(),
          description: item.description ? String(item.description).trim() : null,
          category: sanitizedCat,
          day_number: validDay,
          order_index: validOrder,
          estimated_cost: validCost,
          currency: item.currency || trip.currency || "USD",
          start_time: item.start_time || null,
          end_time: item.end_time || null,
          date: item.date ? String(item.date) : null,
          notes: item.notes ? String(item.notes).trim() : null,
          trip_stop_id: item.trip_stop_id || null,
          activity_id: item.activity_id || null,
          is_completed: false,
        };
      });

      const { data: newItems, error: batchError } = await supabase
        .from("itinerary_items")
        .insert(insertBatch)
        .select("*, activities(*)");

      if (batchError) {
        console.error("Failed to batch insert itinerary items:", batchError.message);
        return NextResponse.json(
          { error: "Failed to batch save itinerary items" },
          { status: 500 }
        );
      }

      return NextResponse.json({ items: newItems || [] }, { status: 201 });
    }

    const {
      title,
      description,
      category,
      day_number,
      order_index,
      estimated_cost,
      currency,
      start_time,
      end_time,
      notes,
      trip_stop_id,
      activity_id,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Activity title is required" },
        { status: 400 }
      );
    }

    const dayNum = Number(day_number);
    if (!Number.isInteger(dayNum) || dayNum < 1) {
      return NextResponse.json(
        { error: "Valid day number (>= 1) is required" },
        { status: 400 }
      );
    }

    const sanitizedCategory = VALID_CATEGORIES.includes(category)
      ? category
      : "Sightseeing";

    const costNum = Number(estimated_cost);
    const sanitizedCost = isNaN(costNum) || costNum < 0 ? 0 : costNum;

    const orderIdx = Number(order_index);
    const sanitizedOrder = isNaN(orderIdx) || orderIdx < 0 ? 0 : orderIdx;

    const insertData: Record<string, any> = {
      trip_id: tripId,
      title: title.trim(),
      description: description ? String(description).trim() : null,
      category: sanitizedCategory,
      day_number: dayNum,
      order_index: sanitizedOrder,
      estimated_cost: sanitizedCost,
      currency: currency || "USD",
      start_time: start_time || null,
      end_time: end_time || null,
      date: body.date ? String(body.date) : null,
      notes: notes ? String(notes).trim() : null,
      trip_stop_id: trip_stop_id || null,
      activity_id: activity_id || null,
      is_completed: false,
    };

    const { data: newItem, error: insertError } = await supabase
      .from("itinerary_items")
      .insert(insertData)
      .select("*, activities(*)")
      .single();

    if (insertError) {
      console.error("Failed to insert itinerary item:", insertError.message);
      return NextResponse.json(
        { error: "Failed to save itinerary item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err) {
    console.error("Item creation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT: Batch update order and day assignments for reordering
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
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
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    // Perform updates for each item in the batch
    const updatePromises = items.map(async (item: {
      id: string;
      day_number: number;
      order_index: number;
    }) => {
      const dayNum = Number(item.day_number);
      const orderIdx = Number(item.order_index);

      if (!item.id || dayNum < 1 || orderIdx < 0) {
        return;
      }

      return supabase
        .from("itinerary_items")
        .update({
          day_number: dayNum,
          order_index: orderIdx,
        })
        .eq("id", item.id)
        .eq("trip_id", tripId);
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, count: items.length });
  } catch (err) {
    console.error("Batch reorder error:", err);
    return NextResponse.json(
      { error: "Internal server error while reordering items" },
      { status: 500 }
    );
  }
}

