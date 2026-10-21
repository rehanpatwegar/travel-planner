import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Non-persistable sample preview catalog used only if Supabase cities table is unreachable or empty.
// Stable non-UUID IDs ensure clients never use fallback identifiers as Supabase foreign keys.
export const FALLBACK_CITIES = [
  {
    id: "fallback-paris",
    name: "Paris",
    country: "France",
    country_code: "FRA",
    region: "Western Europe",
    description: "The City of Light, renowned for art, fashion, gastronomy, and world-famous monuments along the Seine.",
    image_url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
    latitude: 48.856614,
    longitude: 2.352222,
    average_daily_cost: 180.00,
    currency: "EUR",
    is_popular: true,
    rating: 4.9,
    is_fallback: true,
  },
  {
    id: "fallback-lucerne",
    name: "Lucerne",
    country: "Switzerland",
    country_code: "CHE",
    region: "Western Europe",
    description: "A picturesque Swiss city set against snowcapped Mount Pilatus and Lake Lucerne, famous for medieval architecture.",
    image_url: "https://images.unsplash.com/photo-1527668752968-14dc70a27c95?auto=format&fit=crop&w=1200&q=80",
    latitude: 47.050168,
    longitude: 8.309307,
    average_daily_cost: 220.00,
    currency: "CHF",
    is_popular: true,
    rating: 4.85,
    is_fallback: true,
  },
  {
    id: "fallback-florence",
    name: "Florence",
    country: "Italy",
    country_code: "ITA",
    region: "Southern Europe",
    description: "Cradle of the Renaissance, celebrated for masterworks of art, world-class Tuscan cuisine, and historic marble domes.",
    image_url: "https://images.unsplash.com/photo-1543429776-2782fc8e1acd?auto=format&fit=crop&w=1200&q=80",
    latitude: 43.769560,
    longitude: 11.255814,
    average_daily_cost: 160.00,
    currency: "EUR",
    is_popular: true,
    rating: 4.88,
    is_fallback: true,
  },
  {
    id: "fallback-tokyo",
    name: "Tokyo",
    country: "Japan",
    country_code: "JPN",
    region: "East Asia",
    description: "A dynamic metropolis harmonizing neon-lit skyscrapers, historic shrines, Michelin dining, and rich pop culture.",
    image_url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80",
    latitude: 35.676192,
    longitude: 139.650311,
    average_daily_cost: 150.00,
    currency: "JPY",
    is_popular: true,
    rating: 4.92,
    is_fallback: true,
  },
  {
    id: "fallback-nyc",
    name: "New York City",
    country: "United States",
    country_code: "USA",
    region: "North America",
    description: "The global capital of culture, skyline architecture, Broadway theater, and iconic park avenues.",
    image_url: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80",
    latitude: 40.712776,
    longitude: -74.005974,
    average_daily_cost: 250.00,
    currency: "USD",
    is_popular: true,
    rating: 4.82,
    is_fallback: true,
  },
  {
    id: "fallback-barcelona",
    name: "Barcelona",
    country: "Spain",
    country_code: "ESP",
    region: "Southern Europe",
    description: "Catalonia's vibrant seaside city famous for Gaudí's whimsical architecture, sunlit beaches, and lively tapas culture.",
    image_url: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=80",
    latitude: 41.387917,
    longitude: 2.169919,
    average_daily_cost: 170.00,
    currency: "EUR",
    is_popular: true,
    rating: 4.86,
    is_fallback: true,
  },
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cities")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("Cities catalog query notice (using fallback preview):", error.message);
      return NextResponse.json(FALLBACK_CITIES, {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(FALLBACK_CITIES, {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    console.warn("Cities route error (using fallback preview):", err);
    return NextResponse.json(FALLBACK_CITIES, {
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
        { error: "Unauthorized. Please sign in to add catalog cities." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      name,
      country,
      country_code,
      region,
      description,
      average_daily_cost,
      currency,
      image_url,
      latitude,
      longitude,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "City name is required." },
        { status: 400 }
      );
    }

    if (!country || typeof country !== "string" || !country.trim()) {
      return NextResponse.json(
        { error: "Country is required." },
        { status: 400 }
      );
    }

    const costNum = Number(average_daily_cost);
    const safeCost = !isNaN(costNum) && costNum >= 0 ? costNum : 0;
    const safeCurrency =
      typeof currency === "string" && currency.trim().length >= 2
        ? currency.trim().toUpperCase().slice(0, 3)
        : "USD";

    const { data: newCity, error: insertError } = await supabase
      .from("cities")
      .insert({
        name: name.trim(),
        country: country.trim(),
        country_code: country_code ? String(country_code).trim().slice(0, 3) : null,
        region: region ? String(region).trim() : null,
        description: description ? String(description).trim() : null,
        average_daily_cost: safeCost,
        currency: safeCurrency,
        image_url: image_url ? String(image_url).trim() : null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert city into catalog:", insertError.message);
      if (insertError.code === "23505" || insertError.message?.toLowerCase().includes("duplicate key")) {
        return NextResponse.json(
          { error: `The city "${name.trim()}" in ${country.trim()} already exists in the catalog.` },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Database insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(newCity, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Cities POST error:", err);
    return NextResponse.json(
      { error: "Internal server error while saving city." },
      { status: 500 }
    );
  }
}

