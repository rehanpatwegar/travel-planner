import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Non-persistable sample preview catalog used only if Supabase activities table is unreachable or empty.
// Stable non-UUID IDs ensure clients never use fallback identifiers as Supabase foreign keys.
export const FALLBACK_ACTIVITIES = [
  {
    id: "fallback-act-louvre",
    title: "Louvre Museum & Tuileries Garden",
    city_name: "Paris",
    country: "France",
    description: "Explore iconic masterpieces including the Mona Lisa and Venus de Milo in the world's largest art museum.",
    category: "Culture & History",
    estimated_cost: 22.00,
    currency: "EUR",
    duration_minutes: 180,
    rating: 4.85,
    address: "Rue de Rivoli, 75001 Paris",
    image_url: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-eiffel",
    title: "Eiffel Tower Summit Experience",
    city_name: "Paris",
    country: "France",
    description: "Ascend to the top deck of the iron lady for breathtaking panoramic views across the Parisian skyline.",
    category: "Sightseeing",
    estimated_cost: 35.00,
    currency: "EUR",
    duration_minutes: 120,
    rating: 4.70,
    address: "Champ de Mars, 5 Av. Anatole France, 75007 Paris",
    image_url: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-pilatus",
    title: "Mount Pilatus Golden Round Trip",
    city_name: "Lucerne",
    country: "Switzerland",
    description: "Travel via boat, the world's steepest cogwheel railway, and aerial cableway to Mount Pilatus summit.",
    category: "Adventure",
    estimated_cost: 85.00,
    currency: "CHF",
    duration_minutes: 300,
    rating: 4.95,
    address: "Pilatusstrasse 1, 6010 Kriens",
    image_url: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-chapel-bridge",
    title: "Chapel Bridge & Historic Old Town Walk",
    city_name: "Lucerne",
    country: "Switzerland",
    description: "Stroll across Europe's oldest wooden covered bridge and discover Lucerne's fresco-adorned guild squares.",
    category: "Culture & History",
    estimated_cost: 0.00,
    currency: "CHF",
    duration_minutes: 60,
    rating: 4.75,
    address: "Kapellbrücke, 6002 Luzern",
    image_url: "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-uffizi",
    title: "Uffizi Gallery Renaissance Tour",
    city_name: "Florence",
    country: "Italy",
    description: "Witness Botticelli's The Birth of Venus, Leonardo da Vinci, and Michelangelo masterpieces.",
    category: "Culture & History",
    estimated_cost: 28.00,
    currency: "EUR",
    duration_minutes: 150,
    rating: 4.90,
    address: "Piazzale degli Uffizi, 6, 50122 Firenze",
    image_url: "https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-pasta-workshop",
    title: "Tuscan Hand-Made Pasta & Gelato Workshop",
    city_name: "Florence",
    country: "Italy",
    description: "Learn classical pasta making with a local Florentine chef followed by regional wine tasting and dessert.",
    category: "Food & Dining",
    estimated_cost: 75.00,
    currency: "EUR",
    duration_minutes: 180,
    rating: 4.92,
    address: "Via Faenza, 50123 Firenze",
    image_url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-shibuya-sky",
    title: "Shibuya Sky & Scramble Crossing",
    city_name: "Tokyo",
    country: "Japan",
    description: "Step out onto the open-air 360-degree observation deck perched 229 meters above bustling Shibuya.",
    category: "Sightseeing",
    estimated_cost: 20.00,
    currency: "JPY",
    duration_minutes: 75,
    rating: 4.75,
    address: "2 Chome-24-12 Shibuya, Tokyo 150-0002",
    image_url: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-tsukiji",
    title: "Tsukiji Outer Market Morning Food Walk",
    city_name: "Tokyo",
    country: "Japan",
    description: "Sample freshly prepared sushi, grilled wagyu skewers, tamagoyaki omelettes, and Japanese street bites.",
    category: "Food & Dining",
    estimated_cost: 45.00,
    currency: "JPY",
    duration_minutes: 120,
    rating: 4.90,
    address: "4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045",
    image_url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-sagrada-familia",
    title: "Sagrada Família Basilica Tour",
    city_name: "Barcelona",
    country: "Spain",
    description: "Marvel at Antoni Gaudí's awe-inspiring basilica with forest-like stone columns and stained glass.",
    category: "Culture & History",
    estimated_cost: 34.00,
    currency: "EUR",
    duration_minutes: 120,
    rating: 4.95,
    address: "C/ de Mallorca, 401, 08013 Barcelona",
    image_url: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
  {
    id: "fallback-act-met",
    title: "Metropolitan Museum of Art (The Met)",
    city_name: "New York City",
    country: "United States",
    description: "Experience over 5,000 years of global art spanning ancient Egyptian temples to modern masters.",
    category: "Culture & History",
    estimated_cost: 30.00,
    currency: "USD",
    duration_minutes: 180,
    rating: 4.92,
    address: "1000 5th Ave, New York, NY 10028",
    image_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80",
    is_fallback: true,
  },
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("activities")
      .select("*, cities(name, country)")
      .order("title", { ascending: true });

    if (error) {
      console.warn("Activities catalog query notice (using fallback preview):", error.message);
      return NextResponse.json(FALLBACK_ACTIVITIES, {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(FALLBACK_ACTIVITIES, {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    // Format if cities is joined
    const formatted = data.map((item: any) => ({
      ...item,
      city_name: item.cities?.name || "Destination",
      country: item.cities?.country || "",
    }));

    return NextResponse.json(formatted, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    console.warn("Activities route error (using fallback preview):", err);
    return NextResponse.json(FALLBACK_ACTIVITIES, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to add catalog activities." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      title,
      city_id,
      city_name,
      category,
      description,
      estimated_cost,
      currency,
      duration_minutes,
      address,
      image_url,
      rating,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Activity title is required." },
        { status: 400 }
      );
    }

    let resolvedCityId = city_id && typeof city_id === "string" ? city_id.trim() : null;

    // If city_id is omitted or fallback, try resolving via city_name
    if (!resolvedCityId && city_name) {
      const { data: matchedCity } = await supabase
        .from("cities")
        .select("id")
        .ilike("name", String(city_name).trim())
        .maybeSingle();

      if (matchedCity) {
        resolvedCityId = matchedCity.id;
      }
    }

    if (!resolvedCityId) {
      return NextResponse.json(
        { error: "A valid city_id or existing catalog city_name is required to add an activity." },
        { status: 400 }
      );
    }

    const VALID_CATEGORIES = [
      "Sightseeing",
      "Food & Dining",
      "Culture & History",
      "Adventure",
      "Nature",
      "Entertainment",
      "Shopping",
      "Relaxation",
    ];

    const safeCategory = VALID_CATEGORIES.includes(category) ? category : "Sightseeing";
    const costNum = Number(estimated_cost);
    const safeCost = !isNaN(costNum) && costNum >= 0 ? costNum : 0;
    const durNum = Number(duration_minutes);
    const safeDuration = Number.isInteger(durNum) && durNum > 0 ? durNum : 60;
    const safeCurrency =
      typeof currency === "string" && currency.trim().length >= 2
        ? currency.trim().toUpperCase().slice(0, 3)
        : "USD";

    const { data: newActivity, error: insertError } = await supabase
      .from("activities")
      .insert({
        title: title.trim(),
        city_id: resolvedCityId,
        category: safeCategory,
        description: description ? String(description).trim() : null,
        estimated_cost: safeCost,
        currency: safeCurrency,
        duration_minutes: safeDuration,
        address: address ? String(address).trim() : null,
        image_url: image_url ? String(image_url).trim() : null,
        rating: typeof rating === "number" ? Math.min(5, Math.max(0, rating)) : null,
      })
      .select("*, cities(name, country)")
      .single();

    if (insertError) {
      console.error("Failed to insert activity into catalog:", insertError.message);
      if (insertError.code === "23505" || insertError.message?.toLowerCase().includes("duplicate key")) {
        return NextResponse.json(
          { error: `An activity with the title "${title.trim()}" already exists for this destination.` },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Database insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    const formatted = {
      ...newActivity,
      city_name: (newActivity as any).cities?.name || "Destination",
      country: (newActivity as any).cities?.country || "",
    };

    return NextResponse.json(formatted, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Activities POST error:", err);
    return NextResponse.json(
      { error: "Internal server error while saving activity." },
      { status: 500 }
    );
  }
}

