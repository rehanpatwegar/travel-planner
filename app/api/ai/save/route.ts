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

    if (!draft || !draft.tripTitle || !Array.isArray(draft.days) || draft.days.length === 0) {
      return NextResponse.json(
        { error: "Invalid draft payload. Title and days are required." },
        { status: 400 }
      );
    }

    // 2. Insert into `trips` table respecting RLS
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
        (d) => d.cityName.toLowerCase() === cityName.toLowerCase()
      );
      const arrivalDate = cityDays[0]?.date || draft.startDate || null;
      const departureDate = cityDays[cityDays.length - 1]?.date || draft.endDate || null;

      const { data: stop, error: stopError } = await supabase
        .from("trip_stops")
        .insert({
          trip_id: trip.id,
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

    // 4. Prepare and batch insert itinerary items
    const itemsToInsert: Record<string, any>[] = [];

    draft.days.forEach((day) => {
      const dayNum = Number(day.dayNumber) || 1;
      const stopId =
        (day.cityName && stopCityMap.get(day.cityName.toLowerCase())) || defaultStopId || null;

      (day.activities || []).forEach((act, actIndex) => {
        itemsToInsert.push({
          trip_id: trip.id,
          trip_stop_id: stopId,
          day_number: dayNum,
          date: day.date || null,
          title: act.title || "Planned Activity",
          description: act.description || null,
          category: act.category || "Sightseeing",
          start_time: act.startTime || null,
          end_time: act.endTime || null,
          order_index: actIndex,
          estimated_cost: Number(act.estimatedCost) || 0,
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
        console.warn("Failed to bulk insert itinerary items:", itemsError.message);
      }
    }

    return NextResponse.json({
      success: true,
      tripId: trip.id,
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

