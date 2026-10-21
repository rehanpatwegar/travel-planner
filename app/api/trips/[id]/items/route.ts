import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeDateForDay, getStopIdForDay } from "@/lib/utils";

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
      .select("id, user_id, currency, start_date")
      .eq("id", tripId)
      .single();

    if (tripError || !trip || trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden or Trip Not Found" },
        { status: 403 }
      );
    }

    // Fetch verified stops for this trip
    const { data: stops } = await supabase
      .from("trip_stops")
      .select("id, arrival_date, departure_date, order_index")
      .eq("trip_id", tripId)
      .order("order_index", { ascending: true });

    const body = await request.json();

    // Support batch insertion when body.items array is provided
    if (Array.isArray(body.items)) {
      if (body.items.length === 0) {
        return NextResponse.json({ items: [] }, { status: 200 });
      }

      // Verify real activity_ids to avoid foreign key errors from phantom records
      const candidateActivityIds = Array.from(
        new Set(
          body.items
            .map((it: any) => it.activity_id)
            .filter(
              (id: any) =>
                typeof id === "string" &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  id.trim()
                )
            )
        )
      );

      let realActivityIdSet = new Set<string>();
      if (candidateActivityIds.length > 0) {
        const { data: realActs } = await supabase
          .from("activities")
          .select("id")
          .in("id", candidateActivityIds);
        if (realActs) {
          realActivityIdSet = new Set(realActs.map((a: any) => a.id));
        }
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

        const validStopId = item.trip_stop_id && stops?.some((s) => s.id === item.trip_stop_id)
          ? item.trip_stop_id
          : getStopIdForDay(stops || [], trip.start_date, validDay);

        const calculatedDate = item.date
          ? String(item.date)
          : computeDateForDay(trip.start_date, validDay);

        const validActivityId =
          item.activity_id && realActivityIdSet.has(item.activity_id.trim())
            ? item.activity_id.trim()
            : null;

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
          date: calculatedDate,
          notes: item.notes ? String(item.notes).trim() : null,
          trip_stop_id: validStopId,
          activity_id: validActivityId,
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

    const validStopId = trip_stop_id && stops?.some((s) => s.id === trip_stop_id)
      ? trip_stop_id
      : getStopIdForDay(stops || [], trip.start_date, dayNum);

    const calculatedDate = body.date
      ? String(body.date)
      : computeDateForDay(trip.start_date, dayNum);

    let safeActivityId: string | null = null;
    if (activity_id && typeof activity_id === "string") {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          activity_id.trim()
        );
      if (isUuid) {
        const { data: realAct } = await supabase
          .from("activities")
          .select("id")
          .eq("id", activity_id.trim())
          .maybeSingle();
        if (realAct) {
          safeActivityId = realAct.id;
        }
      }
    }

    const insertData: Record<string, any> = {
      trip_id: tripId,
      title: title.trim(),
      description: description ? String(description).trim() : null,
      category: sanitizedCategory,
      day_number: dayNum,
      order_index: sanitizedOrder,
      estimated_cost: sanitizedCost,
      currency: currency || trip.currency || "USD",
      start_time: start_time || null,
      end_time: end_time || null,
      date: calculatedDate,
      notes: notes ? String(notes).trim() : null,
      trip_stop_id: validStopId,
      activity_id: safeActivityId,
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
 * Batch update order and day assignments for reordering (Supports PUT and PATCH)
 */
async function handleBatchReorder(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify trip ownership and fetch date configuration
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, start_date")
      .eq("id", tripId)
      .single();

    if (tripError || !trip || trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden or Trip Not Found" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    // Protect against unbounded payloads
    if (items.length > 200) {
      return NextResponse.json(
        { error: "Batch limit exceeded (maximum 200 items per request)" },
        { status: 400 }
      );
    }

    // Validate item IDs and ordering parameters
    const seenIds = new Set<string>();
    const validatedItems: { id: string; day_number: number; order_index: number }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== "object") {
        return NextResponse.json(
          { error: `Invalid item format at index ${i}` },
          { status: 400 }
        );
      }

      const id = typeof item.id === "string" ? item.id.trim() : "";
      if (!id) {
        return NextResponse.json(
          { error: `Item id is required at index ${i}` },
          { status: 400 }
        );
      }

      if (seenIds.has(id)) {
        return NextResponse.json(
          { error: `Duplicate item id detected in reorder batch: ${id}` },
          { status: 400 }
        );
      }
      seenIds.add(id);

      const dayNum = Number(item.day_number);
      if (!Number.isInteger(dayNum) || dayNum < 1) {
        return NextResponse.json(
          { error: `Item ${id} has invalid day_number. Must be an integer >= 1.` },
          { status: 400 }
        );
      }

      const orderIdx = Number(item.order_index);
      if (!Number.isInteger(orderIdx) || orderIdx < 0) {
        return NextResponse.json(
          { error: `Item ${id} has invalid order_index. Must be an integer >= 0.` },
          { status: 400 }
        );
      }

      validatedItems.push({ id, day_number: dayNum, order_index: orderIdx });
    }

    // Verify all items belong to this trip
    const itemIds = validatedItems.map((it) => it.id);
    const { data: dbItems, error: dbItemsError } = await supabase
      .from("itinerary_items")
      .select("id")
      .eq("trip_id", tripId)
      .in("id", itemIds);

    if (dbItemsError) {
      console.error("Error verifying itinerary items ownership:", dbItemsError.message);
      return NextResponse.json(
        { error: "Failed to verify itinerary items in database" },
        { status: 500 }
      );
    }

    const verifiedDbIds = new Set((dbItems || []).map((it) => it.id));
    const unverifiedIds = itemIds.filter((id) => !verifiedDbIds.has(id));
    if (unverifiedIds.length > 0) {
      return NextResponse.json(
        {
          error: `One or more items do not belong to this trip: ${unverifiedIds.slice(0, 3).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Fetch verified stops for this trip
    const { data: stops } = await supabase
      .from("trip_stops")
      .select("id, arrival_date, departure_date, order_index")
      .eq("trip_id", tripId)
      .order("order_index", { ascending: true });

    // Perform updates for each item in the batch
    const updatePromises = validatedItems.map(async (item) => {
      const updateData: Record<string, any> = {
        day_number: item.day_number,
        order_index: item.order_index,
      };

      const calculatedDate = computeDateForDay(trip.start_date, item.day_number);
      if (calculatedDate) {
        updateData.date = calculatedDate;
      }

      const validStopId = getStopIdForDay(stops || [], trip.start_date, item.day_number);
      if (validStopId) {
        updateData.trip_stop_id = validStopId;
      }

      return supabase
        .from("itinerary_items")
        .update(updateData)
        .eq("id", item.id)
        .eq("trip_id", tripId);
    });

    const results = await Promise.all(updatePromises);
    const failure = results.find((r) => r && r.error);
    if (failure && failure.error) {
      console.error("Failed to update item order:", failure.error.message);
      return NextResponse.json(
        { error: `Failed to update item ordering: ${failure.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, count: validatedItems.length });
  } catch (err) {
    console.error("Batch reorder error:", err);
    return NextResponse.json(
      { error: "Internal server error while reordering items" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleBatchReorder(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleBatchReorder(request, context);
}

