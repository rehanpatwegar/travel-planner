import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to apply optimization." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { tripId, approvedChanges } = body;

    if (!tripId || typeof tripId !== "string") {
      return NextResponse.json(
        { error: "Trip ID is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(approvedChanges) || approvedChanges.length === 0) {
      return NextResponse.json(
        { error: "No changes provided to apply." },
        { status: 400 }
      );
    }

    // 2. Verify trip ownership
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this trip." },
        { status: 403 }
      );
    }

    // 3. Apply updates safely to itinerary_items
    let appliedCount = 0;

    for (const change of approvedChanges) {
      const {
        itemId,
        suggestedDay,
        suggestedOrder,
        suggestedStartTime,
        suggestedEndTime,
      } = change;

      if (!itemId || typeof itemId !== "string") continue;

      const updatePayload: Record<string, any> = {};

      if (typeof suggestedDay === "number" && suggestedDay >= 1) {
        updatePayload.day_number = suggestedDay;
      }
      if (typeof suggestedOrder === "number" && suggestedOrder >= 0) {
        updatePayload.order_index = suggestedOrder;
      }
      if (suggestedStartTime !== undefined) {
        updatePayload.start_time = suggestedStartTime || null;
      }
      if (suggestedEndTime !== undefined) {
        updatePayload.end_time = suggestedEndTime || null;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from("itinerary_items")
          .update(updatePayload)
          .eq("id", itemId)
          .eq("trip_id", tripId); // Strict scoping to trip

        if (!updateError) {
          appliedCount++;
        } else {
          console.warn(`Failed to update item ${itemId}:`, updateError.message);
        }
      }
    }

    // 4. Fetch the full updated items list to send back
    const { data: updatedItems } = await supabase
      .from("itinerary_items")
      .select("*, activities(*)")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true })
      .order("order_index", { ascending: true });

    return NextResponse.json({
      success: true,
      appliedCount,
      items: updatedItems || [],
      message: `Successfully applied ${appliedCount} itinerary optimization(s).`,
    });
  } catch (error) {
    console.error("AI Optimize Apply route error:", error);
    return NextResponse.json(
      { error: "Internal server error while applying optimizations." },
      { status: 500 }
    );
  }
}

