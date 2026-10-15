import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tripId, messages, question, message, destination: reqDest, budget: reqBudget } = body;

    // Extract user question
    let userQuestion = "";
    if (typeof question === "string" && question.trim()) {
      userQuestion = question.trim();
    } else if (typeof message === "string" && message.trim()) {
      userQuestion = message.trim();
    } else if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      userQuestion = typeof last === "string" ? last : (last?.content || "");
    }

    if (!userQuestion.trim()) {
      return NextResponse.json(
        { error: "A question or message is required." },
        { status: 400 }
      );
    }

    // Default trip context
    let destination = reqDest || "Leh, Ladakh";
    let tripTitle = "Travel Plan";
    let dates = "Upcoming";
    let budget = reqBudget || "Flexible";
    let activitiesSummary = "General sightseeing and cultural exploration.";

    // Try fetching Supabase data if user is authenticated and tripId is provided
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user && tripId) {
        const { data: trip } = await supabase
          .from("trips")
          .select("*")
          .eq("id", tripId)
          .maybeSingle();

        if (trip) {
          tripTitle = trip.title || tripTitle;
          budget = trip.total_budget ? `${trip.currency || "USD"} ${trip.total_budget}` : budget;
          dates = trip.start_date
            ? `${trip.start_date} to ${trip.end_date || "Open"}`
            : dates;

          const { data: stops } = await supabase
            .from("trip_stops")
            .select("custom_city_name")
            .eq("trip_id", tripId);

          if (stops && stops.length > 0) {
            destination = stops.map((s) => s.custom_city_name).filter(Boolean).join(", ");
          }

          const { data: items } = await supabase
            .from("itinerary_items")
            .select("title, category, day_number, start_time, end_time, estimated_cost, currency")
            .eq("trip_id", tripId)
            .order("day_number", { ascending: true })
            .order("order_index", { ascending: true });

          if (items && items.length > 0) {
            activitiesSummary = items
              .map((i) => `Day ${i.day_number}: ${i.title} (${i.category}${i.start_time ? `, ${i.start_time}` : ""})`)
              .join("\n");
          }
        }
      }
    } catch {
      // In guest or automated test mode without Supabase session, continue with body context
    }

    // Read Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "your-gemini-api-key") {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in server environment." },
        { status: 500 }
      );
    }

    // Build system prompt
    const systemPrompt = `You are GlobeTrotter Copilot, an expert AI travel assistant. Answer any travel-related or itinerary question naturally, concisely, and accurately based on the current trip context provided. If suggesting an activity, provide its title, approximate cost, and time slot.

=== CURRENT TRIP CONTEXT ===
Destination: ${destination}
Trip Title: ${tripTitle}
Dates / Season: ${dates}
Budget: ${budget}
Current Itinerary / Activities:
${activitiesSummary}

=== INSTRUCTIONS ===
- Answer the user's question directly, naturally, and helpfully in markdown.
- For practical travel questions (such as packing advice, weather, high-altitude advice for Leh Ladakh in October/November, acclimatization, local food, or cultural etiquette), give comprehensive and realistic advice.
- If recommending a specific activity, specify its approximate cost, time slot, and best day.
- Do NOT return dummy, canned, or placeholder responses.
`;

    // Build chat turns
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n[USER INITIATION]\nHello!` }],
      },
      {
        role: "model",
        parts: [
          {
            text: `Hello! I am your GlobeTrotter Copilot for ${destination}. How can I assist you today?`,
          },
        ],
      },
    ];

    if (Array.isArray(messages)) {
      messages.slice(-8, -1).forEach((m: any) => {
        if (m && m.content) {
          contents.push({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: String(m.content) }],
          });
        }
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: userQuestion }],
    });

    // Try available active models: gemini-3.8-flash first, then gemini-2.5-flash, etc.
    const models = [
      "gemini-3.8-flash",
      "gemini-2.5-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
    ];

    let responseText = "";
    let lastError = "";

    for (const model of models) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: 0.6,
                maxOutputTokens: 1200,
              },
            }),
          }
        );

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          lastError = `Model ${model} returned HTTP ${res.status}: ${errText.slice(0, 150)}`;
          continue;
        }

        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          data?.text ||
          "";

        if (text && text.trim()) {
          responseText = text.trim();
          break;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!responseText) {
      return NextResponse.json(
        { error: `Gemini API call failed: ${lastError || "No response received"}` },
        { status: 500 }
      );
    }

    let cleanReplyText = responseText;
    let suggestedActivity: any = null;

    if (responseText.trim().startsWith("{") && responseText.includes("replyText")) {
      try {
        const parsed = JSON.parse(responseText);
        cleanReplyText = parsed.replyText || responseText;
        suggestedActivity = parsed.suggestedActivity || null;
      } catch {
        // use responseText as is
      }
    }

    return NextResponse.json({
      replyText: cleanReplyText,
      message: cleanReplyText,
      reply: cleanReplyText,
      suggestedActivity,
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Internal server error while processing Copilot request.";
    console.error("AI Assistant route error:", errorMsg);

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
