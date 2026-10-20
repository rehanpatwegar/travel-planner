import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Supabase Authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication is required to use the AI assistant." },
        { status: 401 }
      );
    }

    // 2. Enforce Rate Limiting (15 requests per minute per authenticated user)
    const rateLimit = checkRateLimit(`assistant:${user.id}`, 15, 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Too many requests. Please wait a moment before trying again.",
        },
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

    // 3. Parse and Validate Request Body & Limits
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const { tripId, messages, question, message, destination: reqDest, budget: reqBudget } = body;

    // Validate messages array if provided
    if (messages !== undefined) {
      if (!Array.isArray(messages)) {
        return NextResponse.json(
          { error: "Messages payload must be an array." },
          { status: 400 }
        );
      }
      if (messages.length > 20) {
        return NextResponse.json(
          { error: "Messages array exceeds maximum limit of 20 items." },
          { status: 400 }
        );
      }
      for (const m of messages) {
        const text = typeof m === "string" ? m : (typeof m?.content === "string" ? m.content : "");
        if (text.length > 2000) {
          return NextResponse.json(
            { error: "Individual message length exceeds 2,000 characters limit." },
            { status: 400 }
          );
        }
      }
    }

    // Extract user question
    let userQuestion = "";
    if (typeof question === "string" && question.trim()) {
      userQuestion = question.trim();
    } else if (typeof message === "string" && message.trim()) {
      userQuestion = message.trim();
    } else if (Array.isArray(messages) && messages.length > 0) {
      const last = messages[messages.length - 1];
      userQuestion = typeof last === "string" ? last.trim() : (last?.content || "").trim();
    }

    if (!userQuestion) {
      return NextResponse.json(
        { error: "A question or message is required." },
        { status: 400 }
      );
    }

    if (userQuestion.length > 1000) {
      return NextResponse.json(
        { error: "Question exceeds maximum allowed limit of 1,000 characters." },
        { status: 400 }
      );
    }

    // 4. Determine Trip Context dynamically
    let hasTripContext = false;
    let destination = "";
    let tripTitle = "";
    let dates = "";
    let budget = "";
    let activitiesSummary = "";

    // 5. If tripId is provided, verify trip ownership strictly and read actual trip context
    if (tripId !== undefined && tripId !== null) {
      if (typeof tripId !== "string" || !tripId.trim()) {
        return NextResponse.json(
          { error: "Invalid tripId provided." },
          { status: 400 }
        );
      }

      const trimmedTripId = tripId.trim();
      if (!UUID_REGEX.test(trimmedTripId)) {
        return NextResponse.json(
          { error: "Invalid tripId format. Must be a valid UUID." },
          { status: 400 }
        );
      }

      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", trimmedTripId)
        .maybeSingle();

      if (tripError || !trip) {
        return NextResponse.json(
          { error: "Trip not found." },
          { status: 404 }
        );
      }

      if (trip.user_id !== user.id) {
        return NextResponse.json(
          { error: "Forbidden. You do not own this trip." },
          { status: 403 }
        );
      }

      hasTripContext = true;
      tripTitle = trip.title ? trip.title.trim() : "Travel Plan";

      // Calculate dates from actual trip data
      if (trip.start_date) {
        dates = trip.end_date ? `${trip.start_date} to ${trip.end_date}` : `Starts on ${trip.start_date}`;
      } else {
        dates = "Dates not yet scheduled";
      }

      const totalBudgetNum = Number(trip.total_budget);
      const currency = trip.currency || "USD";

      // Fetch stops to get authentic destination cities
      const { data: stops } = await supabase
        .from("trip_stops")
        .select("custom_city_name, cities(name)")
        .eq("trip_id", trip.id)
        .order("order_index", { ascending: true });

      if (stops && stops.length > 0) {
        const stopNames = stops
          .map((s: any) => s.custom_city_name || s.cities?.name)
          .filter(Boolean);
        if (stopNames.length > 0) {
          destination = stopNames.join(", ");
        }
      }

      if (!destination) {
        destination = tripTitle && tripTitle !== "Travel Plan" ? tripTitle : "Your Trip Destination";
      }

      // Fetch actual scheduled itinerary items
      const { data: items } = await supabase
        .from("itinerary_items")
        .select("title, category, day_number, start_time, end_time, estimated_cost, currency")
        .eq("trip_id", trip.id)
        .order("day_number", { ascending: true })
        .order("order_index", { ascending: true });

      if (items && items.length > 0) {
        const plannedCost = items.reduce(
          (sum, it) => sum + (Number(it.estimated_cost) || 0),
          0
        );

        if (totalBudgetNum > 0) {
          const remaining = Math.max(0, totalBudgetNum - plannedCost);
          budget = `${currency} ${totalBudgetNum.toLocaleString()} (Planned Activities: ${currency} ${plannedCost.toLocaleString()}, Remaining: ${currency} ${remaining.toLocaleString()})`;
        } else {
          budget = `Planned Activities: ${currency} ${plannedCost.toLocaleString()} (No overall budget cap set)`;
        }

        activitiesSummary = items
          .map(
            (i) =>
              `Day ${i.day_number}: ${i.title} [${i.category}]${
                i.start_time ? ` (${i.start_time.slice(0, 5)}${i.end_time ? `-${i.end_time.slice(0, 5)}` : ""})` : ""
              }${Number(i.estimated_cost) > 0 ? ` - ${i.currency || currency} ${i.estimated_cost}` : ""}`
          )
          .join("\n");
      } else {
        activitiesSummary = "No activities scheduled yet.";
        if (totalBudgetNum > 0) {
          budget = `${currency} ${totalBudgetNum.toLocaleString()} (No activities scheduled yet)`;
        } else {
          budget = "No budget specified";
        }
      }
    } else if (reqDest && typeof reqDest === "string" && reqDest.trim()) {
      hasTripContext = true;
      destination = reqDest.trim();
      tripTitle = `${destination} Plan`;
      dates = "Dates not specified";
      budget = reqBudget ? String(reqBudget) : "No budget specified";
      activitiesSummary = "No activities scheduled yet.";
    }

    // 6. Read Gemini API Key exclusively from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "" || apiKey === "your-gemini-api-key") {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in server environment." },
        { status: 500 }
      );
    }

    // 7. Build dynamic system prompt & chat turns based on genuine context
    let systemPrompt = "";
    let assistantGreeting = "";

    if (hasTripContext) {
      const isHighAltitude = /ladakh|leh|tibetan|himalay|alps|cusco|la paz|everest/i.test(destination);
      const altitudeGuidance = isHighAltitude
        ? "- Because this destination is in a high-altitude mountain region, provide realistic weather, temperature, and acclimatization advice when relevant."
        : "";

      systemPrompt = `You are GlobeTrotter Copilot, an expert AI travel assistant. Answer any travel-related or itinerary question naturally, concisely, and accurately based on the current trip context provided.

=== CURRENT TRIP CONTEXT ===
Destination: ${destination}
Trip Title: ${tripTitle}
Dates / Season: ${dates}
Budget: ${budget}
Current Itinerary / Activities:
${activitiesSummary}

=== INSTRUCTIONS ===
- Answer the user's question directly, naturally, and helpfully in markdown.
- Tailor all recommendations, tips, weather, clothing, food, and culture strictly to the destination (${destination}). Do NOT introduce advice for unrelated destinations.
${altitudeGuidance}
- When recommending a specific activity that the user can add to their itinerary, provide its structured details so GlobeTrotter can present an actionable card. Format either as top-level JSON:
  {
    "replyText": "Markdown response text...",
    "suggestedActivity": {
      "title": "Activity Name",
      "cost": 0,
      "time_slot": "HH:MM-HH:MM",
      "day_index": 1
    }
  }
  or include a \`\`\`json block with the suggestedActivity object.
- If no specific activity is recommended for addition, reply naturally in markdown without a suggestedActivity.
- Do NOT return dummy, canned, or placeholder responses.
`;

      assistantGreeting = `Hello! I am your GlobeTrotter Copilot for **${tripTitle}** (${destination}). How can I assist with your plans, packing, local tips, or schedule today?`;
    } else {
      // When no trip is selected, respond generically without inventing trip details or destinations
      systemPrompt = `You are GlobeTrotter Copilot, an expert AI travel assistant.

=== CURRENT CONTEXT ===
No specific trip is currently selected. Assist the user with general travel advice, destination recommendations, packing guidelines, flight/train planning, or whatever travel question they ask.
- If the user mentions a specific destination in their question (e.g., Delhi, Paris, Tokyo), answer accurately and specifically for that destination.
- Do NOT assume or invent a destination (such as Leh, Ladakh or Paris) if the user has not mentioned it.
- Do NOT invent fake itinerary activities, scheduled dates, or budgets.
- Answer questions directly, concisely, and helpfully in markdown.
- Do NOT return dummy, canned, or placeholder responses.
`;

      assistantGreeting = `Hello! I am your GlobeTrotter Copilot. How can I help you explore destinations, plan your travels, or answer any travel questions today?`;
    }

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n[USER INITIATION]\nHello!` }],
      },
      {
        role: "model",
        parts: [
          {
            text: assistantGreeting,
          },
        ],
      },
    ];

    if (Array.isArray(messages)) {
      const lastMsgText =
        messages.length > 0
          ? (typeof messages[messages.length - 1] === "string"
              ? messages[messages.length - 1]
              : messages[messages.length - 1]?.content || "").trim()
          : "";

      const historyItems =
        lastMsgText && lastMsgText === userQuestion
          ? messages.slice(-8, -1)
          : messages.slice(-8);

      historyItems.forEach((m: any) => {
        const text = typeof m === "string" ? m : (typeof m?.content === "string" ? m.content : "");
        if (text) {
          contents.push({
            role: m?.role === "assistant" ? "model" : "user",
            parts: [{ text: text.slice(0, 2000) }],
          });
        }
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: userQuestion }],
    });

    // 8. Call Gemini with verified models, x-goog-api-key header, and bounded cumulative timeout
    // In standard serverless environments (e.g. Vercel Hobby), functions have a 15-second execution limit.
    // We allocate a 14-second cumulative deadline with a generous 12-second primary timeout.
    // The fallback model is attempted only if at least 5 seconds remain, avoiding predictable timeouts.
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const modelsToTry = [primaryModel, "gemini-3-flash-preview"].filter(
      (m, idx, arr) => arr.indexOf(m) === idx
    );

    let responseText = "";
    let lastError = "";
    let wasTimeout = false;
    const deadline = Date.now() + 14000; // 14s max cumulative budget for 15s serverless limits

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      const remainingBudget = deadline - Date.now();

      // Only attempt fallback model if at least 5 seconds remain; avoid sequential retries that predictably time out
      if (i > 0 && remainingBudget < 5000) {
        break;
      }

      if (remainingBudget <= 1000) {
        wasTimeout = true;
        break;
      }

      // Prioritize giving primary request enough time to finish (up to 12s within remaining budget)
      const attemptTimeout = Math.min(12000, remainingBudget);

      // Add thinkingConfig: { thinkingBudget: 0 } on supported models to eliminate reasoning latency
      const generationConfig: Record<string, any> = {
        temperature: 0.6,
        maxOutputTokens: 1200,
      };

      if (model.includes("3") || model.includes("2.5") || model.includes("flash")) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), attemptTimeout);

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents,
            generationConfig,
          }),
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          lastError = `Model ${model} returned HTTP ${res.status}`;
          console.warn(`Gemini API warning (${model}): HTTP ${res.status}`);
          continue;
        }

        const data = await res.json().catch(() => null);
        const candidate = data?.candidates?.[0];
        let text = "";
        if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
          text = candidate.content.parts.map((p: any) => p.text || "").join("").trim();
        } else if (typeof data?.text === "string") {
          text = data.text.trim();
        }

        if (text) {
          responseText = text;
          break;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("abort") || msg.toLowerCase().includes("timeout")) {
          wasTimeout = true;
          lastError = "Request timed out";
        } else {
          lastError = msg;
        }
      }
    }

    if (!responseText) {
      const statusCode = wasTimeout ? 504 : 502;
      return NextResponse.json(
        {
          error: wasTimeout
            ? "AI assistant request timed out. Please try again."
            : "AI assistant service is temporarily unavailable. Please try again shortly.",
        },
        { status: statusCode }
      );
    }

    let cleanReplyText = responseText;
    let suggestedActivity: {
      title: string;
      cost: number;
      time_slot?: string;
      day_index?: number;
    } | null = null;

    // Helper to sanitize and validate raw suggested activity structures
    function sanitizeSuggestedActivity(raw: any) {
      if (!raw || typeof raw !== "object") return null;
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      if (!title) return null;

      let cost = 0;
      if (typeof raw.cost === "number" && !isNaN(raw.cost)) {
        cost = Math.max(0, raw.cost);
      } else if (typeof raw.cost === "string") {
        const parsed = parseFloat(raw.cost.replace(/[^0-9.]/g, ""));
        cost = isNaN(parsed) ? 0 : Math.max(0, parsed);
      }

      let time_slot: string | undefined = undefined;
      if (typeof raw.time_slot === "string" && raw.time_slot.trim()) {
        time_slot = raw.time_slot.trim();
      }

      let day_index: number | undefined = undefined;
      const dayNum = Number(raw.day_index);
      if (Number.isInteger(dayNum) && dayNum >= 1) {
        day_index = dayNum;
      }

      return {
        title,
        cost,
        ...(time_slot ? { time_slot } : {}),
        ...(day_index ? { day_index } : {}),
      };
    }

    // 1. Try parsing full response as JSON (with or without code fences)
    let candidateJson = responseText.trim();
    if (candidateJson.startsWith("```json")) {
      candidateJson = candidateJson.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    } else if (candidateJson.startsWith("```")) {
      candidateJson = candidateJson.replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    }

    if (candidateJson.startsWith("{") && candidateJson.endsWith("}")) {
      try {
        const parsed = JSON.parse(candidateJson);
        if (typeof parsed.replyText === "string" && parsed.replyText.trim()) {
          cleanReplyText = parsed.replyText.trim();
        }
        if (parsed.suggestedActivity) {
          suggestedActivity = sanitizeSuggestedActivity(parsed.suggestedActivity);
        } else if (parsed.title && !parsed.replyText) {
          suggestedActivity = sanitizeSuggestedActivity(parsed);
          cleanReplyText = `Here is a suggested activity: **${suggestedActivity?.title}**.`;
        }
      } catch {
        // Fall back to scanning for embedded blocks
      }
    }

    // 2. Scan for embedded JSON blocks if not yet extracted
    if (!suggestedActivity) {
      const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i;
      const match = responseText.match(jsonBlockRegex);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.suggestedActivity) {
            suggestedActivity = sanitizeSuggestedActivity(parsed.suggestedActivity);
            cleanReplyText = responseText.replace(match[0], "").trim();
          } else if (parsed.title) {
            suggestedActivity = sanitizeSuggestedActivity(parsed);
            cleanReplyText = responseText.replace(match[0], "").trim();
          }
        } catch {
          // Gracefully ignore malformed embedded block
        }
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
      { error: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
