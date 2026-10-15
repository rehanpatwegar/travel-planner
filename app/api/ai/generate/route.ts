import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateTripWithGemini,
  generateHeuristicTrip,
  type AITripRequest,
} from "@/lib/ai/generator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to generate AI trips." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      destination,
      startDate,
      endDate,
      totalBudget,
      currency,
      interests,
      pace,
      travelersCount,
      preferences,
    } = body;

    // Validate destination
    if (!destination || typeof destination !== "string" || !destination.trim()) {
      return NextResponse.json(
        { error: "Destination is required (e.g., 'Paris, France' or 'Tokyo and Kyoto')." },
        { status: 400 }
      );
    }

    // Default dates if omitted
    const today = new Date();
    const defaultStart = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const defaultEnd = new Date(today.getTime() + 11 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const safeStartDate =
      startDate && typeof startDate === "string" && !isNaN(Date.parse(startDate))
        ? startDate
        : defaultStart;

    const safeEndDate =
      endDate && typeof endDate === "string" && !isNaN(Date.parse(endDate))
        ? endDate
        : defaultEnd;

    if (new Date(safeEndDate) < new Date(safeStartDate)) {
      return NextResponse.json(
        { error: "End date must be on or after start date." },
        { status: 400 }
      );
    }

    const budgetNum = Number(totalBudget);
    const safeBudget = isNaN(budgetNum) || budgetNum < 0 ? 0 : Math.min(budgetNum, 10000000);

    const safeCurrency =
      typeof currency === "string" && currency.trim().length >= 2
        ? currency.trim().toUpperCase().slice(0, 3)
        : "USD";

    const safeInterests = Array.isArray(interests)
      ? interests.filter((i) => typeof i === "string" && i.trim().length > 0)
      : ["Sightseeing", "Food & Dining"];

    const safePace: "relaxed" | "moderate" | "fast-paced" =
      pace === "relaxed" || pace === "fast-paced" ? pace : "moderate";

    const travelers = Number(travelersCount);
    const safeTravelers = !Number.isInteger(travelers) || travelers < 1 ? 1 : Math.min(travelers, 20);

    const aiRequest: AITripRequest = {
      destination: destination.trim(),
      startDate: safeStartDate,
      endDate: safeEndDate,
      totalBudget: safeBudget,
      currency: safeCurrency,
      interests: safeInterests,
      pace: safePace,
      travelersCount: safeTravelers,
      preferences: typeof preferences === "string" ? preferences.trim() : undefined,
    };

    try {
      const draft = await generateTripWithGemini(aiRequest);
      return NextResponse.json({ draft });
    } catch (genError) {
      console.warn("AI generation failed, applying heuristic fallback:", genError);
      const fallbackDraft = generateHeuristicTrip(aiRequest);
      return NextResponse.json({ draft: fallbackDraft });
    }
  } catch (error) {
    console.error("AI Generate route error:", error);
    return NextResponse.json(
      { error: "Internal server error while generating trip plan." },
      { status: 500 }
    );
  }
}

