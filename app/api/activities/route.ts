import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Fallback activities matching db/seed.sql if Supabase is offline or not yet connected
const FALLBACK_ACTIVITIES = [
  {
    id: "22222222-2222-2222-2222-222222222201",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222202",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222203",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222204",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222205",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222206",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222207",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222208",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222209",
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
  },
  {
    id: "22222222-2222-2222-2222-222222222210",
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
  },
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("activities")
      .select("*, cities(name, country)")
      .order("title", { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json(FALLBACK_ACTIVITIES, { status: 200 });
    }

    // Format if cities is joined
    const formatted = data.map((item: any) => ({
      ...item,
      city_name: item.cities?.name || "Destination",
      country: item.cities?.country || "",
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch {
    return NextResponse.json(FALLBACK_ACTIVITIES, { status: 200 });
  }
}

