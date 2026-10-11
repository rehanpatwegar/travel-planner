import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Fallback sample data matching db/seed.sql if Supabase is offline or not yet connected
const FALLBACK_CITIES = [
  {
    id: "11111111-1111-1111-1111-111111111101",
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
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
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
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
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
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
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
  },
  {
    id: "11111111-1111-1111-1111-111111111105",
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
  },
  {
    id: "11111111-1111-1111-1111-111111111106",
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
  },
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cities")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      // If Supabase is not yet populated or credentials are placeholder, return fallback
      return NextResponse.json(FALLBACK_CITIES, { status: 200 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    // If Supabase connection fails, return fallback
    return NextResponse.json(FALLBACK_CITIES, { status: 200 });
  }
}

