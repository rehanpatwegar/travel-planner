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

