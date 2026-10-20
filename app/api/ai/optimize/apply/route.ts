import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { computeDateForDay, getStopIdForDay } from "@/lib/utils";

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

    // Rate limiting: 20 apply operations per minute per user
    const rateLimit = checkRateLimit(`optimize-apply:${user.id}`, 20, 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a moment before trying again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.resetSeconds),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
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

    // 2. Verify trip ownership and fetch date configuration
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, start_date, end_date")
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

    // Fetch verified stops for this trip to keep activity-city associations accurate
    const { data: stops } = await supabase
      .from("trip_stops")
      .select("id, arrival_date, departure_date, order_index")
      .eq("trip_id", tripId)
      .order("order_index", { ascending: true });

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

        // Keep date synchronized with trip start_date and calendar
        if (trip.start_date) {
          updatePayload.date = computeDateForDay(trip.start_date, suggestedDay);
        }

        // Keep activity stop association synchronized with destination city
        const targetStopId = getStopIdForDay(stops || [], trip.start_date, suggestedDay);
        if (targetStopId) {
          updatePayload.trip_stop_id = targetStopId;
        }
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

    // 4. Prevent duplicate order_index values and ensure destination-day ordering remains consistent
    const { data: currentItems } = await supabase
      .from("itinerary_items")
      .select("id, day_number, order_index, start_time, created_at")
      .eq("trip_id", tripId);

    if (currentItems && currentItems.length > 0) {
      // Group by day_number
      const itemsByDay = new Map<number, typeof currentItems>();
      for (const item of currentItems) {
        const d = item.day_number || 1;
        if (!itemsByDay.has(d)) itemsByDay.set(d, []);
        itemsByDay.get(d)!.push(item);
      }

      // Ensure strictly sequential order_index (0, 1, 2...) on every day without collisions
      for (const [, dayItems] of itemsByDay) {
        dayItems.sort((a, b) => {
          if (a.order_index !== b.order_index) {
            return a.order_index - b.order_index;
          }
          const timeA = a.start_time || "99:99";
          const timeB = b.start_time || "99:99";
          if (timeA !== timeB) return timeA.localeCompare(timeB);
          return (a.created_at || "").localeCompare(b.created_at || "") || a.id.localeCompare(b.id);
        });

        for (let idx = 0; idx < dayItems.length; idx++) {
          const it = dayItems[idx];
          if (it.order_index !== idx) {
            await supabase
              .from("itinerary_items")
              .update({ order_index: idx })
              .eq("id", it.id)
              .eq("trip_id", tripId);
          }
        }
      }
    }

    // 5. Fetch the full updated items list to send back
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

