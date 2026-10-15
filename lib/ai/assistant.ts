/**
 * Server-side Conversational Trip Assistant (Copilot)
 * Connects directly to Google Gemini API (gemini-3.8-flash) using GEMINI_API_KEY.
 * Dynamically answers any travel-related or itinerary question without hardcoded responses.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SuggestedActivity {
  title: string;
  cost: number;
  time_slot?: string;
  day_index?: number;
}

export interface CopilotReply {
  replyText: string;
  suggestedActivity?: SuggestedActivity | null;
}

export interface TripChatContext {
  trip: {
    id: string;
    title: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    total_budget: number;
    currency: string;
  };
  stops: Array<{
    id: string;
    custom_city_name: string | null;
    arrival_date: string | null;
    departure_date: string | null;
  }>;
  items: Array<{
    id: string;
    day_number: number;
    order_index: number;
    title: string;
    description: string | null;
    category: string;
    start_time: string | null;
    end_time: string | null;
    estimated_cost: number;
    currency: string;
    notes: string | null;
    is_completed?: boolean;
  }>;
  expenses?: Array<{
    title: string;
    amount: number;
    currency: string;
    category?: string;
  }>;
}

/**
 * Call Gemini to produce dynamic, context-aware answers to ANY user question.
 * Throws descriptive errors if GEMINI_API_KEY is missing or the external API call fails.
 */
export async function generateChatReplyWithGemini(
  ctx: TripChatContext,
  messages: ChatMessage[]
): Promise<CopilotReply> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your-gemini-api-key") {
    throw new Error(
      "GEMINI_API_KEY is missing or invalid in server environment (.env.local). Please set a valid Gemini API key to use AI Copilot."
    );
  }

  const trip = ctx.trip;
  const items = ctx.items || [];
  const stops = ctx.stops || [];
  const expenses = ctx.expenses || [];

  // Determine destinations
  const destinationsStr =
    stops
      .map((s) => s.custom_city_name)
      .filter(Boolean)
      .join(", ") ||
    trip.title ||
    "Destination";

  // Calculate budget metrics
  const totalBudget = Number(trip.total_budget) || 0;
  const totalPlannedCost = items.reduce(
    (sum, i) => sum + (Number(i.estimated_cost) || 0),
    0
  );
  const remainingBudget = Math.max(0, totalBudget - totalPlannedCost);
  const currency = trip.currency || "USD";

  // Build daily itinerary schedule context
  const itemsByDay: Record<number, typeof items> = {};
  items.forEach((item) => {
    const d = item.day_number || 1;
    if (!itemsByDay[d]) itemsByDay[d] = [];
    itemsByDay[d].push(item);
  });

  let scheduleContext = "";
  Object.keys(itemsByDay)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((dStr) => {
      const dNum = Number(dStr);
      scheduleContext += `Day ${dNum}:\n`;
      const dayList = itemsByDay[dNum] || [];
      if (dayList.length === 0) {
        scheduleContext += "  (No activities scheduled)\n";
      } else {
        dayList
          .sort((a, b) => a.order_index - b.order_index)
          .forEach((act) => {
            const time = act.start_time
              ? `${act.start_time.slice(0, 5)}${act.end_time ? `-${act.end_time.slice(0, 5)}` : ""}`
              : "Flexible time";
            const cost = Number(act.estimated_cost) > 0 ? `${currency} ${act.estimated_cost}` : "Free";
            scheduleContext += `  - ${act.title} [${act.category}] (${time}, ${cost})\n`;
          });
      }
    });

  const loggedExpensesStr =
    expenses.length > 0
      ? expenses.map((e) => `  - ${e.title}: ${currency} ${e.amount} (${e.category || "General"})`).join("\n")
      : "  None recorded";

  const systemPrompt = `You are GlobeTrotter Copilot, an expert AI travel assistant. Answer any travel-related or itinerary question naturally, concisely, and accurately based on the current trip context provided. If suggesting an activity, provide its title, approximate cost, and time slot.

=== CURRENT TRIP CONTEXT ===
Trip Title: ${trip.title}
Destination(s): ${destinationsStr}
Dates: ${trip.start_date || "Not set"} to ${trip.end_date || "Not set"}
Total Budget: ${currency} ${totalBudget.toLocaleString()}
Total Planned Activity Cost: ${currency} ${totalPlannedCost.toLocaleString()}
Remaining Budget: ${currency} ${remainingBudget.toLocaleString()}

=== CURRENT DAILY ITINERARY ===
${scheduleContext || "No activities scheduled yet."}

=== LOGGED REAL EXPENSES ===
${loggedExpensesStr}

=== INSTRUCTIONS ===
1. Answer ANY user question dynamically and contextually (e.g. clothing/packing advice, local customs, weather expectations, itinerary advice, budget status, fun facts, dining recommendations, hidden gems, day summaries).
2. Never repeat canned or hardcoded responses.
3. If the user asks for suggestions or an activity recommendation, you may propose an actionable activity.
4. Return your output strictly as a JSON object matching this schema:
{
  "replyText": "Natural language markdown response answering the user question.",
  "suggestedActivity": null or {
    "title": "Activity name",
    "cost": number (estimated cost in numbers only, 0 for free),
    "time_slot": "HH:MM-HH:MM",
    "day_index": number (e.g. 1, 2)
  }
}
If no new activity is being suggested or the user is just asking a general question (e.g. packing advice, fun facts, budget check), set "suggestedActivity" to null.`;

  // Build conversational turns for Gemini
  const recentMessages = messages.slice(-10);

  const contents = [
    {
      role: "user",
      parts: [{ text: `${systemPrompt}\n\n[USER INITIATION]\nHello!` }],
    },
    {
      role: "model",
      parts: [
        {
          text: JSON.stringify({
            replyText: `Hello! I am your GlobeTrotter Copilot for **${trip.title}** (${destinationsStr}). How can I assist with your plans, packing, local tips, or schedule today?`,
            suggestedActivity: null,
          }),
        },
      ],
    },
  ];

  recentMessages.forEach((m) => {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  });

  const modelsToTry = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
  ];

  let lastError = "";

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        lastError = `Gemini API model ${model} failed with HTTP ${res.status}: ${errorBody.slice(0, 200)}`;
        console.warn(lastError);
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        lastError = `Empty response received from Gemini model ${model}.`;
        continue;
      }

      try {
        const parsed = JSON.parse(rawText);
        return {
          replyText: String(parsed.replyText || rawText).trim(),
          suggestedActivity: parsed.suggestedActivity || null,
        };
      } catch {
        // If not valid JSON, treat rawText as natural language reply
        return {
          replyText: rawText.trim(),
          suggestedActivity: null,
        };
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`Error during Gemini API call (${model}):`, lastError);
    }
  }

  // If all models failed, throw descriptive error rather than returning canned text
  throw new Error(`Gemini Copilot request failed: ${lastError || "Could not reach Google Gemini service."}`);
}
