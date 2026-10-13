import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    const {
      city_id,
      custom_city_name,
      arrival_date,
      departure_date,
      notes,
      order_index,
    } = body;

    if (!city_id && (!custom_city_name || !custom_city_name.trim())) {
      return NextResponse.json(
        { error: "City ID or custom city name is required" },
        { status: 400 }
      );
    }

    const orderIdx = Number(order_index);
    const sanitizedOrder = isNaN(orderIdx) || orderIdx < 0 ? 0 : orderIdx;

    const { data: newStop, error: insertError } = await supabase
      .from("trip_stops")
      .insert({
        trip_id: tripId,
        city_id: city_id || null,
        custom_city_name: custom_city_name ? custom_city_name.trim() : null,
        arrival_date: arrival_date || null,
        departure_date: departure_date || null,
        notes: notes ? notes.trim() : null,
        order_index: sanitizedOrder,
      })
      .select("*, cities(*)")
      .single();

    if (insertError) {
      console.error("Failed to insert stop:", insertError.message);
      return NextResponse.json(
        { error: "Failed to add destination stop" },
        { status: 500 }
      );
    }

    return NextResponse.json({ stop: newStop }, { status: 201 });
  } catch (err) {
    console.error("Stop creation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

