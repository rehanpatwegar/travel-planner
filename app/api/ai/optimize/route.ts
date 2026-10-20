import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { optimizeItineraryWithGemini } from "@/lib/ai/optimizer";
import { checkRateLimit } from "@/lib/security/rateLimit";

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
        { error: "Unauthorized. Please sign in to optimize itineraries." },
        { status: 401 }
      );
    }

    // Rate limiting: 10 optimization requests per minute per user
    const rateLimit = checkRateLimit(`optimize:${user.id}`, 10, 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a moment before analyzing again." },
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
    const { tripId } = body;

    if (!tripId || typeof tripId !== "string") {
      return NextResponse.json(
        { error: "Trip ID is required." },
        { status: 400 }
      );
    }

    // 2. Verify trip ownership
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to optimize this trip." },
        { status: 403 }
      );
    }

    // 3. Fetch stops
    const { data: stops } = await supabase
      .from("trip_stops")
      .select("*")
      .eq("trip_id", tripId)
      .order("order_index", { ascending: true });

    // 4. Fetch itinerary items
    const { data: items } = await supabase
      .from("itinerary_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true })
      .order("order_index", { ascending: true });

    // 5. Optimize itinerary using Gemini with fallback
    const result = await optimizeItineraryWithGemini({
      trip,
      stops: stops || [],
      items: items || [],
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("AI Optimize route error:", error);
    return NextResponse.json(
      { error: "Internal server error while analyzing itinerary." },
      { status: 500 }
    );
  }
}

