/**
 * Server-side AI Itinerary Optimizer
 * Analyzes existing trips, identifies scheduling conflicts, overloaded pacing,
 * and sequencing inefficiencies, and proposes non-destructive optimization diffs.
 */

export interface OptimizeTripRequest {
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
    city_id: string | null;
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
    trip_stop_id: string | null;
  }>;
}

export interface ProposedItemChange {
  itemId: string;
  title: string;
  category: string;
  originalDay: number;
  originalOrder: number;
  originalStartTime: string | null;
  originalEndTime: string | null;
  suggestedDay: number;
  suggestedOrder: number;
  suggestedStartTime: string | null;
  suggestedEndTime: string | null;
  reason: string;
}

export interface OptimizationAnalysis {
  pacingSummary: string;
  budgetSummary: string;
  timingObservations: string[];
  recommendations: string[];
  assumptions: string[];
}

export interface OptimizationResult {
  analysis: OptimizationAnalysis;
  changes: ProposedItemChange[];
  source: "gemini" | "heuristic";
}

/**
 * Intelligent heuristic fallback optimizer when GEMINI_API_KEY is not configured or unavailable.
 */
export function optimizeItineraryHeuristic(req: OptimizeTripRequest): OptimizationResult {
  const items = req.items || [];
  const changes: ProposedItemChange[] = [];
  const timingObservations: string[] = [];
  const recommendations: string[] = [];

  // 1. Group items by day
  const itemsByDay: Record<number, typeof items> = {};
  items.forEach((item) => {
    const d = item.day_number || 1;
    if (!itemsByDay[d]) itemsByDay[d] = [];
    itemsByDay[d].push(item);
  });

  // Calculate total costs
  const totalCost = items.reduce(
    (sum, item) => sum + (Number(item.estimated_cost) || 0),
    0
  );
  const budget = Number(req.trip.total_budget) || 0;

  // Recommended sequence pattern by category:
  // Morning: Sightseeing / Culture & History
  // Midday: Food & Dining
  // Afternoon: Nature / Adventure / Shopping / Relaxation
  // Evening: Food & Dining / Entertainment
  const categoryOrderWeight: Record<string, number> = {
    "Sightseeing": 1,
    "Culture & History": 2,
    "Food & Dining": 3,
    "Adventure": 4,
    "Nature": 5,
    "Shopping": 6,
    "Relaxation": 7,
    "Entertainment": 8,
  };

  const defaultSlots = [
    { start: "09:30", end: "11:30" },
    { start: "12:00", end: "13:30" },
    { start: "14:30", end: "17:00" },
    { start: "18:30", end: "20:30" },
  ];

  Object.entries(itemsByDay).forEach(([dayStr, dayItems]) => {
    const dayNum = Number(dayStr);

    if (dayItems.length > 4) {
      timingObservations.push(
        `Day ${dayNum} is heavily loaded with ${dayItems.length} activities, leaving little downtime or travel buffers.`
      );
    } else if (dayItems.length === 0) {
      timingObservations.push(`Day ${dayNum} has no scheduled activities.`);
    }

    // Check time conflicts within day
    for (let i = 0; i < dayItems.length; i++) {
      for (let j = i + 1; j < dayItems.length; j++) {
        const a = dayItems[i];
        const b = dayItems[j];
        if (a.start_time && b.start_time && a.end_time && b.end_time) {
          if (
            (a.start_time <= b.start_time && a.end_time > b.start_time) ||
            (b.start_time <= a.start_time && b.end_time > a.start_time)
          ) {
            timingObservations.push(
              `Timing conflict on Day ${dayNum}: "${a.title}" (${a.start_time}-${a.end_time}) overlaps with "${b.title}" (${b.start_time}-${b.end_time}).`
            );
          }
        }
      }
    }

    // Sort items logically by category weight
    const sorted = [...dayItems].sort((a, b) => {
      const wa = categoryOrderWeight[a.category] ?? 5;
      const wb = categoryOrderWeight[b.category] ?? 5;
      return wa - wb;
    });

    sorted.forEach((item, newOrderIdx) => {
      const assignedSlot = defaultSlots[newOrderIdx] || { start: "16:00", end: "18:00" };
      const currentStart = item.start_time ? item.start_time.slice(0, 5) : null;
      const currentEnd = item.end_time ? item.end_time.slice(0, 5) : null;

      const needsReorder = item.order_index !== newOrderIdx;
      const needsTiming = !currentStart || !currentEnd;

      if (needsReorder || needsTiming) {
        changes.push({
          itemId: item.id,
          title: item.title,
          category: item.category,
          originalDay: item.day_number,
          originalOrder: item.order_index,
          originalStartTime: currentStart,
          originalEndTime: currentEnd,
          suggestedDay: item.day_number,
          suggestedOrder: newOrderIdx,
          suggestedStartTime: currentStart || assignedSlot.start,
          suggestedEndTime: currentEnd || assignedSlot.end,
          reason: needsTiming
            ? `Assigned structured ${assignedSlot.start}-${assignedSlot.end} slot to prevent conflicts.`
            : `Reordered to optimize daily rhythm (${item.category} best scheduled in sequence).`,
        });
      }
    });
  });

  // Budget assessment
  let budgetSummary = "";
  if (budget > 0) {
    if (totalCost > budget) {
      budgetSummary = `Current planned activity cost (${req.trip.currency} ${totalCost.toLocaleString()}) exceeds the planned budget of ${req.trip.currency} ${budget.toLocaleString()} by ${(totalCost - budget).toLocaleString()}. Consider prioritizing free walking tours and public landmarks.`;
      recommendations.push(
        "Look into city passes or free entry museum days to lower planned activity expenses."
      );
    } else {
      budgetSummary = `Current activities (${req.trip.currency} ${totalCost.toLocaleString()}) fit comfortably within your ${req.trip.currency} ${budget.toLocaleString()} budget, leaving ${req.trip.currency} ${(budget - totalCost).toLocaleString()} for dining and unexpected transit.`;
    }
  } else {
    budgetSummary = `Total estimated activity cost is ${req.trip.currency} ${totalCost.toLocaleString()}. No overall budget cap was specified.`;
  }

  // Pacing summary
  let pacingSummary = "";
  const totalDays = Object.keys(itemsByDay).length || 1;
  const avgPerDay = (items.length / totalDays).toFixed(1);
  pacingSummary = `Itinerary has ${items.length} activities distributed over ${totalDays} planned day(s) (average of ${avgPerDay} activities/day).`;

  if (changes.length > 0) {
    recommendations.push(
      `Proposed adjustments for ${changes.length} activities to align daily category flow and assign conflict-free time slots.`
    );
  } else {
    recommendations.push("Your current itinerary is already well-sequenced!");
  }

  return {
    analysis: {
      pacingSummary,
      budgetSummary,
      timingObservations:
        timingObservations.length > 0
          ? timingObservations
          : ["No severe overlapping time conflicts detected in scheduled activities."],
      recommendations,
      assumptions: [
        "Transit times between venues are estimated and depend on local traffic or transit availability.",
        "Opening hours, holiday closures, and live ticket prices require direct verification before visit.",
      ],
    },
    changes,
    source: "heuristic",
  };
}

/**
 * Call Google Gemini API to analyze and optimize the itinerary.
 */
export async function optimizeItineraryWithGemini(
  req: OptimizeTripRequest
): Promise<OptimizationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your-gemini-api-key") {
    return optimizeItineraryHeuristic(req);
  }

  const items = req.items || [];
  if (items.length === 0) {
    return optimizeItineraryHeuristic(req);
  }

  // Build clean sanitized payload for prompt (mitigating prompt injection)
  const stopsSummary = req.stops
    .map((s) => s.custom_city_name)
    .filter(Boolean)
    .join(", ");

  const itemsPayload = items.map((i) => ({
    id: i.id,
    title: i.title,
    category: i.category,
    day_number: i.day_number,
    order_index: i.order_index,
    start_time: i.start_time ? i.start_time.slice(0, 5) : null,
    end_time: i.end_time ? i.end_time.slice(0, 5) : null,
    estimated_cost: Number(i.estimated_cost) || 0,
    notes: i.notes ? i.notes.slice(0, 100) : null,
  }));

  const prompt = `You are GlobeTrotter AI Itinerary Optimizer.
Analyze the following travel itinerary and propose non-destructive optimizations to improve daily activity flow, reduce scheduling conflicts, balance pacing, and review budget feasibility.

=== TRIP INFORMATION ===
Title: ${req.trip.title}
Destinations: ${stopsSummary || "Not specified"}
Dates: ${req.trip.start_date || "Open"} to ${req.trip.end_date || "Open"}
Budget: ${req.trip.total_budget} ${req.trip.currency}

=== ITINERARY ACTIVITIES (JSON) ===
${JSON.stringify(itemsPayload, null, 2)}

=== OPTIMIZATION RULES ===
1. Only reference existing activity items using their exact "id" from the input. Do NOT invent new activities.
2. For each day, propose an optimal chronological order (morning sightseeing -> midday lunch -> afternoon cultural/outdoor -> evening dining/entertainment).
3. If activities lack start/end times or have overlapping times, suggest realistic non-conflicting time slots in "HH:MM" 24h format.
4. If a day has more than 4 activities, note it as overloaded.
5. If total estimated cost exceeds the user's budget, note it clearly in budgetSummary and offer cost-conscious advice.
6. Clearly state any assumptions and missing data (e.g. transit times, exact street addresses).
7. Return ONLY valid JSON matching this exact schema:

{
  "analysis": {
    "pacingSummary": "string",
    "budgetSummary": "string",
    "timingObservations": ["string"],
    "recommendations": ["string"],
    "assumptions": ["string"]
  },
  "changes": [
    {
      "itemId": "exact_item_id_from_input",
      "suggestedDay": number,
      "suggestedOrder": number,
      "suggestedStartTime": "HH:MM",
      "suggestedEndTime": "HH:MM",
      "reason": "Clear explanation of why this change improves the itinerary"
    }
  ]
}`;

  const modelsToTry = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
  ];

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
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`Gemini optimizer returned HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) continue;

      const parsed = JSON.parse(rawText);

      if (!parsed.analysis || !Array.isArray(parsed.changes)) {
        throw new Error("Invalid structure returned by Gemini optimizer");
      }

      // Map changes back to original item details for complete diff display
      const itemsMap = new Map(items.map((i) => [i.id, i]));
      const sanitizedChanges: ProposedItemChange[] = [];

      for (const ch of parsed.changes) {
        const original = itemsMap.get(ch.itemId);
        if (!original) continue; // Skip if invalid ID hallucinated

        const origStart = original.start_time ? original.start_time.slice(0, 5) : null;
        const origEnd = original.end_time ? original.end_time.slice(0, 5) : null;

        sanitizedChanges.push({
          itemId: original.id,
          title: original.title,
          category: original.category,
          originalDay: original.day_number,
          originalOrder: original.order_index,
          originalStartTime: origStart,
          originalEndTime: origEnd,
          suggestedDay: Number(ch.suggestedDay) || original.day_number,
          suggestedOrder: Number(ch.suggestedOrder) ?? original.order_index,
          suggestedStartTime: ch.suggestedStartTime ? String(ch.suggestedStartTime).slice(0, 5) : origStart,
          suggestedEndTime: ch.suggestedEndTime ? String(ch.suggestedEndTime).slice(0, 5) : origEnd,
          reason: String(ch.reason || "Optimized for smoother schedule pacing").trim(),
        });
      }

      return {
        analysis: {
          pacingSummary: String(parsed.analysis.pacingSummary || "Itinerary reviewed.").trim(),
          budgetSummary: String(parsed.analysis.budgetSummary || "Budget evaluated.").trim(),
          timingObservations: Array.isArray(parsed.analysis.timingObservations)
            ? parsed.analysis.timingObservations.map((s: any) => String(s).trim())
            : [],
          recommendations: Array.isArray(parsed.analysis.recommendations)
            ? parsed.analysis.recommendations.map((s: any) => String(s).trim())
            : [],
          assumptions: Array.isArray(parsed.analysis.assumptions)
            ? parsed.analysis.assumptions.map((s: any) => String(s).trim())
            : [
                "Assumes normal operating hours and local transit conditions.",
                "Live prices and entry reservations require verification.",
              ],
        },
        changes: sanitizedChanges,
        source: "gemini",
      };
    } catch (err) {
      console.warn(`Gemini optimizer error (${model}):`, err);
    }
  }

  // Fallback to heuristic optimizer if Gemini fails or times out
  return optimizeItineraryHeuristic(req);
}

