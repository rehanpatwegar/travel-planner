/**
 * Server-side AI Trip Generator
 * Supports Google Gemini API (gemini-2.5-flash / gemini-1.5-flash) with structured JSON output,
 * with safe heuristic planning fallback if GEMINI_API_KEY is not configured or unavailable.
 */

export interface AITripRequest {
  destination: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  currency: string;
  interests: string[];
  pace: "relaxed" | "moderate" | "fast-paced";
  travelersCount: number;
  preferences?: string;
}

export interface AIGeneratedActivity {
  title: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  estimatedCost: number;
  isEstimated: boolean;
  recommendationReason: string;
}

export interface AIGeneratedDay {
  dayNumber: number;
  date?: string;
  cityName: string;
  theme: string;
  activities: AIGeneratedActivity[];
}

export interface AITripDraft {
  tripTitle: string;
  description: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  totalDays: number;
  targetBudget: number;
  currency: string;
  budgetAssessment: {
    totalEstimatedCost: number;
    status: "within_budget" | "exceeds_budget" | "comfortable";
    advice: string;
  };
  days: AIGeneratedDay[];
  disclaimer: string;
  source: "gemini" | "heuristic_fallback";
}

const VALID_CATEGORIES = [
  "Sightseeing",
  "Culture & History",
  "Food & Dining",
  "Adventure",
  "Nature",
  "Entertainment",
  "Shopping",
  "Relaxation",
];

// Helper to compute number of days between two YYYY-MM-DD strings
export function calculateDays(startStr: string, endStr: string): number {
  try {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 && diff <= 30 ? diff : 3;
  } catch {
    return 3;
  }
}

// Format date YYYY-MM-DD + offset in days
export function addDaysToDate(baseDate: string, daysOffset: number): string {
  try {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split("T")[0];
  } catch {
    return baseDate;
  }
}

/**
 * Heuristic Travel Planner
 * Produces structured, realistic itinerary drafts matching user preferences.
 */
export function generateHeuristicTrip(req: AITripRequest): AITripDraft {
  const totalDays = calculateDays(req.startDate, req.endDate);

  // Split multiple destinations (e.g. "Paris, Lucerne" or "Tokyo and Kyoto")
  const rawDestList = req.destination
    .split(/[,&+]|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const destinations = rawDestList.length > 0 ? rawDestList : ["Scenic Destination"];

  const activitiesPerDay =
    req.pace === "relaxed" ? 2 : req.pace === "fast-paced" ? 4 : 3;

  const interests = req.interests.length > 0 ? req.interests : ["Sightseeing", "Food & Dining"];

  // Activity templates pool based on interests
  const templates: Record<string, { title: string; desc: string; cost: number; mins: number }[]> = {
    "Culture & History": [
      {
        title: "Historic Old Town Walking Tour & Landmarks",
        desc: "Explore historic architecture, iconic city squares, and UNESCO heritage monuments.",
        cost: 0,
        mins: 120,
      },
      {
        title: "Renowned Art & History Museum Exhibition",
        desc: "Visit world-class galleries showcasing timeless masterpieces and cultural artifacts.",
        cost: 25,
        mins: 150,
      },
      {
        title: "Heritage Palace & Ancient Cathedral Discovery",
        desc: "Discover centuries-old royal residence halls and vaulted cathedral towers.",
        cost: 20,
        mins: 120,
      },
    ],
    "Food & Dining": [
      {
        title: "Traditional Market Hall & Artisan Food Tasting",
        desc: "Sample regional cheeses, warm pastries, fresh produce, and local delicacies.",
        cost: 30,
        mins: 90,
      },
      {
        title: "Authentic Neighborhood Bistro Dinner",
        desc: "Savor chef-curated seasonal dishes paired with regional wines in a cozy setting.",
        cost: 45,
        mins: 120,
      },
      {
        title: "Scenic Waterfront Café & Coffee Break",
        desc: "Relax with artisanal espresso, fresh pastries, and panoramic city vistas.",
        cost: 15,
        mins: 60,
      },
    ],
    "Sightseeing": [
      {
        title: "Panoramic City Viewpoint & Observation Deck",
        desc: "Enjoy sweeping 360-degree aerial views of the city skyline and surrounding geography.",
        cost: 22,
        mins: 90,
      },
      {
        title: "Iconic Waterfront Promenade & Bridge Walk",
        desc: "Stroll along historic waterways, bustling esplanades, and famous bridges.",
        cost: 0,
        mins: 75,
      },
      {
        title: "Evening Illuminated River / Harbor Cruise",
        desc: "Take in glowing monument facades and skyline reflections from the water.",
        cost: 35,
        mins: 90,
      },
    ],
    "Nature": [
      {
        title: "Botanical Gardens & Tranquil Parkland Walk",
        desc: "Wander through landscaped Japanese gardens, arboretums, and quiet fountains.",
        cost: 10,
        mins: 90,
      },
      {
        title: "Scenic Coastal / Mountain Trail Excursion",
        desc: "Hike well-marked natural ridges with breathtaking vistas of lakes and valleys.",
        cost: 0,
        mins: 180,
      },
    ],
    "Adventure": [
      {
        title: "Guided Bike Tour of Hidden Neighborhoods",
        desc: "Pedal through scenic alleys, historic parks, and vibrant cultural quarters.",
        cost: 35,
        mins: 150,
      },
      {
        title: "Mountain Cable Car & Alpine Ridge Adventure",
        desc: "Ascend high-altitude cableways for alpine scenery and exhilarating walk trails.",
        cost: 55,
        mins: 210,
      },
    ],
    "Shopping": [
      {
        title: "Artisan Boutiques & Historic Covered Passages",
        desc: "Browse independent local designers, antique bookshops, and perfume makers.",
        cost: 0,
        mins: 120,
      },
    ],
    "Relaxation": [
      {
        title: "Thermal Bath & Wellness Retreat",
        desc: "Unwind in rejuvenating natural thermal pools, saunas, and steam rooms.",
        cost: 40,
        mins: 150,
      },
    ],
  };

  const defaultTemplates = [
    {
      title: "City Center Exploration & Architectural Discovery",
      desc: "Orientation walk across central boulevards, historic squares, and gardens.",
      cost: 0,
      mins: 120,
      category: "Sightseeing",
    },
    {
      title: "Culinary Highlights & Traditional Lunch",
      desc: "Taste signature local dishes at an authentic family-run establishment.",
      cost: 28,
      mins: 90,
      category: "Food & Dining",
    },
    {
      title: "Landmark Monument Tour & Scenic Sunset",
      desc: "Visit the city's foremost cultural icon followed by golden-hour photography.",
      cost: 20,
      mins: 120,
      category: "Culture & History",
    },
  ];

  const days: AIGeneratedDay[] = [];
  let cumulativeEstCost = 0;

  for (let d = 1; d <= totalDays; d++) {
    // Distribute destination stops evenly across days
    const destIndex = Math.min(
      Math.floor(((d - 1) / totalDays) * destinations.length),
      destinations.length - 1
    );
    const currentCity = destinations[destIndex];
    const currentDate = addDaysToDate(req.startDate, d - 1);

    const dayActivities: AIGeneratedActivity[] = [];
    const timeSlots = [
      { start: "09:30", end: "11:30" },
      { start: "12:00", end: "14:00" },
      { start: "14:30", end: "17:00" },
      { start: "18:30", end: "20:30" },
    ];

    for (let a = 0; a < activitiesPerDay; a++) {
      const interestCategory = interests[(d + a) % interests.length];
      const categoryPool = templates[interestCategory] || defaultTemplates;
      const picked = categoryPool[(d + a) % categoryPool.length];
      const slot = timeSlots[a] || { start: "15:00", end: "17:00" };

      const estCost = (picked.cost || 0) * Math.max(1, req.travelersCount);
      cumulativeEstCost += estCost;

      dayActivities.push({
        title: `${picked.title} in ${currentCity}`,
        description: picked.desc,
        category: interestCategory || "Sightseeing",
        startTime: slot.start,
        endTime: slot.end,
        durationMinutes: picked.mins || 90,
        estimatedCost: estCost,
        isEstimated: true,
        recommendationReason: `Recommended for ${req.pace} pacing matching your interest in ${interestCategory}.`,
      });
    }

    days.push({
      dayNumber: d,
      date: currentDate,
      cityName: currentCity,
      theme:
        d === 1
          ? `Arrival & ${currentCity} Introduction`
          : d === totalDays
          ? `Farewell Highlights & Leisure in ${currentCity}`
          : `Deep Dive into ${currentCity} & Surroundings`,
      activities: dayActivities,
    });
  }

  // Budget assessment
  const targetBudget = Number(req.totalBudget) || 0;
  let status: "within_budget" | "exceeds_budget" | "comfortable" = "within_budget";
  let advice = "";

  if (targetBudget > 0) {
    if (cumulativeEstCost <= targetBudget * 0.75) {
      status = "comfortable";
      advice = `Your planned budget of ${req.currency} ${targetBudget.toLocaleString()} comfortably accommodates estimated activity costs (${req.currency} ${cumulativeEstCost.toLocaleString()}), leaving ample buffer for lodging, transit, and spontaneous dining.`;
    } else if (cumulativeEstCost <= targetBudget) {
      status = "within_budget";
      advice = `Estimated activity expenses (${req.currency} ${cumulativeEstCost.toLocaleString()}) fit within your ${req.currency} ${targetBudget.toLocaleString()} limit. Keep accommodation and transport in mind.`;
    } else {
      status = "exceeds_budget";
      advice = `Estimated activity fees (${req.currency} ${cumulativeEstCost.toLocaleString()}) exceed your target budget of ${req.currency} ${targetBudget.toLocaleString()}. Consider selecting free walking tours and public parks to optimize costs.`;
    }
  } else {
    advice = `Total estimated activity cost across ${totalDays} days is approximately ${req.currency} ${cumulativeEstCost.toLocaleString()} for ${req.travelersCount} traveler(s). Set a planned budget in the dashboard anytime.`;
  }

  const primaryDest = destinations[0] || "World";
  const title = `${primaryDest} Discovery: ${totalDays}-Day Journey`;

  return {
    tripTitle: title,
    description: `A thoughtfully planned ${totalDays}-day travel experience covering ${destinations.join(
      ", "
    )}, balancing ${req.interests.join(", ")} at a ${req.pace} pace for ${
      req.travelersCount
    } traveler(s).`,
    destinations,
    startDate: req.startDate,
    endDate: req.endDate,
    totalDays,
    targetBudget,
    currency: req.currency || "USD",
    budgetAssessment: {
      totalEstimatedCost: cumulativeEstCost,
      status,
      advice,
    },
    days,
    disclaimer:
      "All activity costs, durations, and timings are planning estimates. Real-time ticket prices, entry availability, and booking hours require independent verification before travel.",
    source: "heuristic_fallback",
  };
}

/**
 * Call Gemini API with structured JSON output schema
 */
export async function generateTripWithGemini(
  req: AITripRequest
): Promise<AITripDraft> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your-gemini-api-key") {
    // Safe heuristic fallback when no key is configured
    return generateHeuristicTrip(req);
  }

  const totalDays = calculateDays(req.startDate, req.endDate);

  const prompt = `You are GlobeTrotter AI, an expert travel planning assistant.
Generate a structured, realistic day-by-day travel itinerary draft based on the following user requirements:
- Destination(s): ${req.destination}
- Dates: ${req.startDate} to ${req.endDate} (${totalDays} full days)
- Total Budget: ${req.currency} ${req.totalBudget || "Not specified"}
- Interests: ${req.interests.join(", ") || "General Sightseeing"}
- Pace: ${req.pace}
- Travelers: ${req.travelersCount}
${req.preferences ? `- Special Preferences / Accessibility: ${req.preferences}` : ""}

Strict Rules:
1. Divide the trip across ${totalDays} days chronologically (Day 1 to Day ${totalDays}).
2. For each day, suggest ${
    req.pace === "relaxed" ? "2" : req.pace === "fast-paced" ? "4" : "3"
  } realistic activities in the destination city.
3. Use only these category names: "Sightseeing", "Culture & History", "Food & Dining", "Adventure", "Nature", "Entertainment", "Shopping", "Relaxation".
4. Provide estimated costs per activity in ${req.currency} (number only, 0 for free parks/walking). Never claim live confirmed prices.
5. Provide realistic 24-hour start and end times in "HH:MM" format.
6. Provide an honest budget feasibility assessment comparing the total estimated activity cost to the user's budget.

Return ONLY a valid JSON object matching this schema:
{
  "tripTitle": "string",
  "description": "string",
  "destinations": ["string"],
  "budgetAssessment": {
    "totalEstimatedCost": number,
    "status": "within_budget" | "exceeds_budget" | "comfortable",
    "advice": "string"
  },
  "days": [
    {
      "dayNumber": number,
      "cityName": "string",
      "theme": "string",
      "activities": [
        {
          "title": "string",
          "description": "string",
          "category": "Sightseeing" | "Culture & History" | "Food & Dining" | "Adventure" | "Nature" | "Entertainment" | "Shopping" | "Relaxation",
          "startTime": "HH:MM",
          "endTime": "HH:MM",
          "durationMinutes": number,
          "estimatedCost": number,
          "isEstimated": true,
          "recommendationReason": "string"
        }
      ]
    }
  ]
}`;

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const modelsToTry = [primaryModel, "gemini-3-flash-preview"].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  const deadline = Date.now() + 15000; // 15s max cumulative timeout

  for (const model of modelsToTry) {
    const remainingBudget = deadline - Date.now();
    if (remainingBudget <= 1000) break;

    const attemptTimeout = Math.min(9000, remainingBudget);

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
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.warn(`Gemini model ${model} returned HTTP ${res.status}:`, errorText.slice(0, 150));
        continue; // Try next model
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      let rawText = "";
      if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
        rawText = candidate.content.parts.map((p: any) => p.text || "").join("").trim();
      } else if (typeof data?.text === "string") {
        rawText = data.text.trim();
      }

      if (!rawText) {
        console.warn(`Empty content from Gemini model ${model}`);
        continue;
      }

      const parsed = JSON.parse(rawText);

      // Validate structured fields
      if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
        throw new Error("Invalid structure: missing days array");
      }

      // Sanitize days and activities
      const sanitizedDays: AIGeneratedDay[] = parsed.days.map((d: any, index: number) => {
        const dayNum = Number(d.dayNumber) || index + 1;
        const activities: AIGeneratedActivity[] = (d.activities || []).map((act: any) => ({
          title: String(act.title || "Curated Attraction").trim(),
          description: String(act.description || "").trim(),
          category: VALID_CATEGORIES.includes(act.category) ? act.category : "Sightseeing",
          startTime: String(act.startTime || "10:00").slice(0, 5),
          endTime: String(act.endTime || "12:00").slice(0, 5),
          durationMinutes: Number(act.durationMinutes) || 90,
          estimatedCost: Math.max(0, Number(act.estimatedCost) || 0),
          isEstimated: true,
          recommendationReason: String(act.recommendationReason || "Matched with your trip interests."),
        }));

        return {
          dayNumber: dayNum,
          date: addDaysToDate(req.startDate, dayNum - 1),
          cityName: String(d.cityName || req.destination).trim(),
          theme: String(d.theme || `Day ${dayNum} Exploration`).trim(),
          activities,
        };
      });

      const totalEstCost = sanitizedDays.reduce(
        (sum, day) =>
          sum +
          day.activities.reduce((dSum, act) => dSum + (Number(act.estimatedCost) || 0), 0),
        0
      );

      const destinationsList = Array.isArray(parsed.destinations) && parsed.destinations.length > 0
        ? parsed.destinations
        : [req.destination];

      return {
        tripTitle: String(parsed.tripTitle || `${req.destination} Adventure`).trim(),
        description: String(parsed.description || `Generated itinerary for ${req.destination}`).trim(),
        destinations: destinationsList,
        startDate: req.startDate,
        endDate: req.endDate,
        totalDays,
        targetBudget: Number(req.totalBudget) || 0,
        currency: req.currency || "USD",
        budgetAssessment: {
          totalEstimatedCost: totalEstCost,
          status:
            parsed.budgetAssessment?.status === "exceeds_budget"
              ? "exceeds_budget"
              : parsed.budgetAssessment?.status === "comfortable"
              ? "comfortable"
              : "within_budget",
          advice: String(
            parsed.budgetAssessment?.advice ||
              `Estimated activity cost is ${req.currency} ${totalEstCost.toLocaleString()}.`
          ),
        },
        days: sanitizedDays,
        disclaimer:
          "All activity costs, durations, and timings are planning estimates generated by Gemini. Real-time ticket prices, entry availability, and booking hours require independent verification before travel.",
        source: "gemini",
      };
    } catch (err: unknown) {
      console.warn(`Error during Gemini API call (${model}):`, err instanceof Error ? err.message : err);
      // Fall through to next model or fallback
    }
  }

  // Fallback to heuristic generation if Gemini calls fail or timeout
  return generateHeuristicTrip(req);
}

