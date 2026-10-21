import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

    // Verify trip ownership
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.user_id !== user.id && !trip.is_public) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch stops
    const { data: stops } = await supabase
      .from("trip_stops")
      .select("*, cities(*)")
      .eq("trip_id", id)
      .order("order_index", { ascending: true });

    // Fetch itinerary items
    const { data: items } = await supabase
      .from("itinerary_items")
      .select("*, activities(*)")
      .eq("trip_id", id)
      .order("day_number", { ascending: true })
      .order("order_index", { ascending: true });

    return NextResponse.json({
      trip,
      stops: stops || [],
      items: items || [],
    });
  } catch (error) {
    console.error("Error fetching trip details:", error);
    return NextResponse.json(
      { error: "Failed to fetch trip data" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
      .select("id, user_id")
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
    const updatePayload: Record<string, any> = {};

    if (body.total_budget !== undefined) {
      const budget = Number(body.total_budget);
      if (isNaN(budget) || budget < 0) {
        return NextResponse.json(
          { error: "Planned budget must be a positive number or zero" },
          { status: 400 }
        );
      }
      if (budget > 100000000) {
        return NextResponse.json(
          { error: "Planned budget exceeds maximum allowed limit" },
          { status: 400 }
        );
      }
      updatePayload.total_budget = budget;
    }

    if (body.currency !== undefined) {
      if (
        typeof body.currency !== "string" ||
        body.currency.trim().length < 2 ||
        body.currency.trim().length > 3
      ) {
        return NextResponse.json(
          { error: "Invalid currency code (e.g. USD, EUR, GBP)" },
          { status: 400 }
        );
      }
      updatePayload.currency = body.currency.trim().toUpperCase();
    }

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
      updatePayload.description = body.description
        ? String(body.description).trim()
        : null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: updatedTrip, error: updateError } = await supabase
      .from("trips")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Failed to update trip:", updateError.message);
      return NextResponse.json(
        { error: "Failed to update trip" },
        { status: 500 }
      );
    }

    return NextResponse.json({ trip: updatedTrip });
  } catch (error) {
    console.error("Error updating trip:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify trip exists and user is the owner
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, title")
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

    // Delete trip (cascades to stops, itinerary items, expenses, and shared_trips)
    const { error: deleteError } = await supabase
      .from("trips")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Failed to delete trip:", deleteError.message);
      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            error:
              "Cannot delete trip: dependent records exist in the database that are protected by foreign key constraints. Verify foreign key CASCADE constraints or apply the transactional deletion RPC.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Failed to delete trip: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Trip deleted successfully",
      id,
      title: trip.title,
    });
  } catch (error) {
    console.error("Error deleting trip:", error);
    return NextResponse.json(
      { error: "Internal server error while deleting trip" },
      { status: 500 }
    );
  }
}


