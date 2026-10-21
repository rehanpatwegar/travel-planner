import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AITripDraft } from "@/lib/ai/generator";

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
        { error: "Unauthorized. Please sign in to save trip." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const draft: AITripDraft = body.draft;
    const existingTripId = typeof body.tripId === "string" && body.tripId.trim() ? body.tripId.trim() : null;

    if (!draft || !draft.tripTitle || !Array.isArray(draft.days) || draft.days.length === 0) {
      return NextResponse.json(
        { error: "Invalid draft payload. Title and days are required." },
        { status: 400 }
      );
    }

    let tripId: string;

    // 2. Resolve target trip: existing verified trip or create new trip
    if (existingTripId) {
      const { data: existingTrip, error: fetchTripError } = await supabase
        .from("trips")
        .select("id, user_id")
        .eq("id", existingTripId)
        .single();

      if (fetchTripError || !existingTrip || existingTrip.user_id !== user.id) {
        return NextResponse.json(
          { error: "Forbidden or target trip not found." },
          { status: 403 }
        );
      }
      tripId = existingTrip.id;
    } else {
      const { data: trip, error: tripInsertError } = await supabase
        .from("trips")
        .insert({
          user_id: user.id,
          title: draft.tripTitle.trim(),
          description: draft.description ? draft.description.trim() : null,
          start_date: draft.startDate || null,
          end_date: draft.endDate || null,
          total_budget: Number(draft.targetBudget) || 0,
          currency: (draft.currency || "USD").toUpperCase(),
        })
        .select()
        .single();

      if (tripInsertError || !trip) {
        console.error("Failed to insert trip:", tripInsertError?.message);
        return NextResponse.json(
          { error: tripInsertError?.message || "Failed to create trip record." },
          { status: 500 }
        );
      }
      tripId = trip.id;
    }

    // 3. Determine unique destinations and insert into `trip_stops`
    const destinationNames =
      Array.isArray(draft.destinations) && draft.destinations.length > 0
        ? draft.destinations
        : Array.from(new Set(draft.days.map((d) => d.cityName).filter(Boolean)));

    const finalDestinations = destinationNames.length > 0 ? destinationNames : ["Primary Destination"];

    // Try to find matching cities in catalog
    const stopCityMap = new Map<string, string>(); // cityName -> stop_id

    for (let i = 0; i < finalDestinations.length; i++) {
      const cityName = finalDestinations[i].trim();

      // Check catalog for existing city
      const { data: matchedCity } = await supabase
        .from("cities")
        .select("id")
        .ilike("name", cityName)
        .maybeSingle();

      // Find day span for this city in draft
      const cityDays = draft.days.filter(
        (d) => d.cityName && d.cityName.toLowerCase() === cityName.toLowerCase()
      );
      const arrivalDate = cityDays[0]?.date || draft.startDate || null;
      const departureDate = cityDays[cityDays.length - 1]?.date || draft.endDate || null;

      const { data: stop, error: stopError } = await supabase
        .from("trip_stops")
        .insert({
          trip_id: tripId,
          city_id: matchedCity?.id || null,
          custom_city_name: cityName,
          order_index: i,
          arrival_date: arrivalDate,
          departure_date: departureDate,
        })
        .select()
        .single();

      if (!stopError && stop) {
        stopCityMap.set(cityName.toLowerCase(), stop.id);
      }
    }

    // Fallback stop if none created
    let defaultStopId: string | null = null;
    if (stopCityMap.size > 0) {
      defaultStopId = Array.from(stopCityMap.values())[0];
    }

    // 4. Prepare and batch insert itinerary items with strict validation
    const itemsToInsert: Record<string, any>[] = [];

    draft.days.forEach((day, dayIndex) => {
      const dayNum = Number(day.dayNumber);
      const safeDayNum = Number.isInteger(dayNum) && dayNum >= 1 ? dayNum : dayIndex + 1;
      const stopId =
        (day.cityName && stopCityMap.get(day.cityName.toLowerCase())) || defaultStopId || null;

      (day.activities || []).forEach((act, actIndex) => {
        if (!act || typeof act !== "object") return;
        const rawTitle = typeof act.title === "string" ? act.title.trim() : "";
        const title = rawTitle || `Day ${safeDayNum} Activity ${actIndex + 1}`;
        const costNum = Number(act.estimatedCost);
        const estimatedCost = !isNaN(costNum) && costNum >= 0 ? costNum : 0;

        itemsToInsert.push({
          trip_id: tripId,
          trip_stop_id: stopId,
          day_number: safeDayNum,
          date: day.date || null,
          title,
          description: act.description ? String(act.description).trim() : null,
          category: act.category || "Sightseeing",
          start_time: act.startTime || null,
          end_time: act.endTime || null,
          order_index: actIndex,
          estimated_cost: estimatedCost,
          currency: (draft.currency || "USD").toUpperCase(),
          notes: act.recommendationReason
            ? `AI Suggestion: ${act.recommendationReason}`
            : null,
          is_completed: false,
        });
      });
    });

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from("itinerary_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Failed to bulk insert itinerary items:", itemsError.message);
        return NextResponse.json(
          { error: `Failed to save itinerary activities: ${itemsError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      tripId,
      message: "AI Trip generated and saved successfully!",
    });
  } catch (error) {
    console.error("AI Save route error:", error);
    return NextResponse.json(
      { error: "Internal server error while saving generated trip." },
      { status: 500 }
    );
  }
}

