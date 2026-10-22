/**
 * Server-side AI Trip Generator
 * Supports Google Gemini API (gemini-2.5-flash / gemini-1.5-flash) with structured JSON output,
 * with safe heuristic planning fallback if GEMINI_API_KEY is not configured or unavailable.
 */

import { estimateTripBenchmarkBudget } from "@/lib/budget/budgetEngine";

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
    isPreliminary?: boolean;
    missingCategories?: string[];
    advice: string;
    breakdown?: {
      accommodation: number;
      food: number;
      transport: number;
      activities: number;
      contingencyBuffer: number;
    };
    assumptions?: string[];
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
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return 1;
    }
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  } catch {
    return 1;
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

interface ActivityTemplate {
  title: string;
  desc: string;
  cost: number;
  mins: number;
  category?: string;
}

/**
 * Destination-aware heuristic activity pool.
 * Selects geographically and culturally relevant activities without assuming European or Alpine archetypes,
 * and ensures all costs are marked as indicative planning estimates rather than verified live prices.
 */
function getDestinationTemplates(
  destination: string,
  currentCity: string
): {
  templates: Record<string, ActivityTemplate[]>;
  defaultTemplates: ActivityTemplate[];
} {
  const place = `${destination} ${currentCity}`.toLowerCase();

  // 1. High-Altitude / Mountain regions
  if (
    /ladakh|leh|himalay|alps|interlaken|zermatt|matterhorn|aspen|banff|rockies|cusco|la paz|everest|manali|shimla|kashmir/i.test(
      place
    )
  ) {
    return {
      templates: {
        "Culture & History": [
          {
            title: "Ancient Hilltop Monastery & Fortress Exploration",
            desc: "Explore sacred mountain architecture, centuries-old shrines, and panoramic valley viewpoints.",
            cost: 10,
            mins: 120,
          },
          {
            title: "Mountain Heritage Village & Folk Culture Walk",
            desc: "Discover traditional stone and timber architecture, local craftsmanship, and cultural heritage.",
            cost: 0,
            mins: 120,
          },
          {
            title: "High-Altitude Cultural Center & Artifact Museum",
            desc: "Learn about regional high-mountain traditions, folklore, and preservation history.",
            cost: 15,
            mins: 90,
          },
        ],
        "Food & Dining": [
          {
            title: "Traditional Mountain Café & Herbal Tea Tasting",
            desc: "Savor local teas, freshly prepared breads, and warm mountain specialties.",
            cost: 15,
            mins: 60,
          },
          {
            title: "Hearty Regional Mountain Dinner",
            desc: "Enjoy wholesome regional comfort dishes crafted from local grains, broths, and fresh seasonal ingredients.",
            cost: 30,
            mins: 90,
          },
          {
            title: "Scenic Valley View Bakery & Refreshment Stop",
            desc: "Relax with freshly baked goods and hot drinks overlooking snowy peaks and rugged valleys.",
            cost: 12,
            mins: 60,
          },
        ],
        "Sightseeing": [
          {
            title: "Panoramic Mountain Pass & Scenic Valley Viewpoint",
            desc: "Marvel at dramatic vistas, winding mountain passes, and sweeping valley landscapes.",
            cost: 0,
            mins: 90,
          },
          {
            title: "Historic Old Town & Market Bazaar Walk",
            desc: "Wander through colorful mountain bazaars, handicraft stalls, and winding cobblestone alleys.",
            cost: 0,
            mins: 90,
          },
          {
            title: "Golden Hour Sunset Over Mountain Peaks",
            desc: "Capture breathtaking alpine/mountain glow across surrounding ridges and canyons.",
            cost: 0,
            mins: 75,
          },
        ],
        "Nature": [
          {
            title: "Glacial Stream & Alpine Meadow Walk",
            desc: "Take a refreshing walk along crystal-clear mountain streams and vibrant valley flora.",
            cost: 0,
            mins: 120,
          },
          {
            title: "Scenic Valley Nature & Wildlife Trail",
            desc: "Spot indigenous high-altitude wildlife and scenic rock formations along marked paths.",
            cost: 0,
            mins: 150,
          },
        ],
        "Adventure": [
          {
            title: "Guided Valley Hiking Trail & Ridge Excursion",
            desc: "Trek along scenic ridge paths with an experienced local guide and stunning vistas.",
            cost: 35,
            mins: 180,
          },
          {
            title: "Mountain Scenic Drive & Photography Safari",
            desc: "Journey across iconic panoramic roads and hidden viewpoint overlooks.",
            cost: 40,
            mins: 180,
          },
        ],
        "Shopping": [
          {
            title: "Mountain Artisan Bazaar & Woolen Handicrafts",
            desc: "Browse authentic handwoven shawls, local woodwork, and artisanal mountain crafts.",
            cost: 0,
            mins: 90,
          },
        ],
        "Relaxation": [
          {
            title: "Natural Hot Springs or Mountain Wellness Spa",
            desc: "Unwind in restorative mineral waters and tranquil alpine wellness pavilions.",
            cost: 30,
            mins: 120,
          },
        ],
      },
      defaultTemplates: [
        {
          title: "Mountain Pass Panoramic Viewpoint",
          desc: "Breathtaking vistas across rugged valleys and high mountain ridges.",
          cost: 0,
          mins: 90,
          category: "Sightseeing",
        },
        {
          title: "Hearty Mountain Specialty Lunch",
          desc: "Warm comforting local dishes at a family-run mountain tavern.",
          cost: 20,
          mins: 75,
          category: "Food & Dining",
        },
        {
          title: "Historic Monastic Fortress & Heritage Trail",
          desc: "Centuries-old stone architecture and cultural museum exhibits.",
          cost: 10,
          mins: 120,
          category: "Culture & History",
        },
      ],
    };
  }

  // 2. Desert / Middle East
  if (
    /dubai|abu dhabi|doha|qatar|cairo|egypt|riyadh|saudi|marrakech|morocco|oman|muscat|jordan|amman|petra|jaisalmer/i.test(
      place
    )
  ) {
    return {
      templates: {
        "Culture & History": [
          {
            title: "Historic Heritage Quarter & Traditional Souk Walk",
            desc: "Explore winding alleys, traditional wind-tower architecture, and historic trading routes.",
            cost: 0,
            mins: 120,
          },
          {
            title: "Heritage Palace & Islamic Arts Museum Tour",
            desc: "Admire historic royal courtyards, intricate stone carvings, and classical art collections.",
            cost: 20,
            mins: 120,
          },
          {
            title: "Ancient Citadel & Cultural Monument Discovery",
            desc: "Walk through historic fortifications and learn the deep historical heritage of the region.",
            cost: 15,
            mins: 120,
          },
        ],
        "Food & Dining": [
          {
            title: "Traditional Mezze & Regional Specialty Feast",
            desc: "Enjoy authentic aromatic rice dishes, grilled skewers, flatbreads, and regional spiced delicacies.",
            cost: 35,
            mins: 90,
          },
          {
            title: "Historic Souk Street Food & Spices Sampling",
            desc: "Taste freshly roasted nuts, local dates, infused teas, and savory pastries in bustling market stalls.",
            cost: 20,
            mins: 75,
          },
          {
            title: "Sunset Rooftop Lounge & Mint Tea Refreshment",
            desc: "Relax with traditional tea, dates, and panoramic skyline or desert-fringe views.",
            cost: 18,
            mins: 60,
          },
        ],
        "Sightseeing": [
          {
            title: "Modern Architectural Marvels & Observation Deck",
            desc: "Experience breathtaking panoramic views from world-renowned architectural observation points.",
            cost: 35,
            mins: 90,
          },
          {
            title: "Historic Creek & Waterfront Promenade Walk",
            desc: "Stroll along historic waterways, traditional wooden boat fronts, and lively evening esplanades.",
            cost: 5,
            mins: 75,
          },
          {
            title: "Illuminated Evening Skyline & Fountain Spectacle",
            desc: "Witness iconic fountains, dazzling architectural light shows, and vibrant city nightlife.",
            cost: 0,
            mins: 60,
          },
        ],
        "Nature": [
          {
            title: "Desert Oasis & Botanical Parkland Walk",
            desc: "Discover lush date palms, flowering desert flora, and tranquil shaded gardens.",
            cost: 10,
            mins: 90,
          },
          {
            title: "Sunset Desert Dunes Excursion",
            desc: "Experience rolling golden sand dunes during peaceful twilight hours.",
            cost: 30,
            mins: 150,
          },
        ],
        "Adventure": [
          {
            title: "Desert Safari & Sand Dunes Experience",
            desc: "Enjoy scenic desert driving, sand boarding, and traditional evening hospitality.",
            cost: 55,
            mins: 210,
          },
          {
            title: "Waterfront Marine Cruise or Marina Tour",
            desc: "Sail past iconic coastal architecture and city landmarks from the water.",
            cost: 40,
            mins: 120,
          },
        ],
        "Shopping": [
          {
            title: "Gold, Perfume & Spice Souk Exploration",
            desc: "Browse authentic saffron, artisanal oils, traditional jewelry, and woven textiles.",
            cost: 0,
            mins: 90,
          },
        ],
        "Relaxation": [
          {
            title: "Traditional Hammam & Thermal Spa Treatment",
            desc: "Indulge in steam baths, restorative body treatments, and calming aromatic relaxation halls.",
            cost: 45,
            mins: 120,
          },
        ],
      },
      defaultTemplates: [
        {
          title: "City Center Exploration & Heritage Promenade",
          desc: "Orientation walk across grand boulevards and historic waterfront districts.",
          cost: 0,
          mins: 90,
          category: "Sightseeing",
        },
        {
          title: "Traditional Regional Lunch & Refreshment",
          desc: "Taste signature regional dishes at a popular local establishment.",
          cost: 25,
          mins: 75,
          category: "Food & Dining",
        },
        {
          title: "Cultural Heritage Museum & Architecture",
          desc: "Discover centuries of regional history and artistic craftsmanship.",
          cost: 15,
          mins: 120,
          category: "Culture & History",
        },
      ],
    };
  }

  // 3. South Asia / Indian Subcontinent
  if (
    /delhi|mumbai|bangalore|bengaluru|kolkata|chennai|hyderabad|agra|varanasi|jaipur|kerala|goa|amritsar|udaipur|lucknow|kathmandu|colombo|sri lanka/i.test(
      place
    )
  ) {
    return {
      templates: {
        "Culture & History": [
          {
            title: "Historic Fort & UNESCO Monument Exploration",
            desc: "Discover grand historic forts, intricate sandstone arches, and majestic regional architecture.",
            cost: 15,
            mins: 150,
          },
          {
            title: "Ancient Heritage Bazaar & Old Quarter Heritage Walk",
            desc: "Wander through centuries-old alleys, vibrant spice markets, and historic town squares.",
            cost: 0,
            mins: 120,
          },
          {
            title: "National Museum & Ancient Art Gallery",
            desc: "Admire rare sculptures, historic manuscripts, and ancient archaeological treasures.",
            cost: 10,
            mins: 120,
          },
        ],
        "Food & Dining": [
          {
            title: "Famous Street Food & Culinary Heritage Tasting",
            desc: "Sample iconic regional chaats, kebabs, warm flatbreads, and renowned local street delicacies.",
            cost: 15,
            mins: 90,
          },
          {
            title: "Authentic Regional Thali & Dining Experience",
            desc: "Savor a multi-course traditional meal featuring regional curries, fragrant rice, and fresh breads.",
            cost: 25,
            mins: 90,
          },
          {
            title: "Historic Tea House & Sweetshop Visit",
            desc: "Enjoy freshly brewed spiced chai, traditional artisanal sweets, and refreshing savory snacks.",
            cost: 8,
            mins: 60,
          },
        ],
        "Sightseeing": [
          {
            title: "Iconic City Memorial & Central Avenue Tour",
            desc: "Visit historic monuments, national memorials, and stately tree-lined boulevards.",
            cost: 0,
            mins: 90,
          },
          {
            title: "Bustling Neighborhood Rickshaw & Walking Discovery",
            desc: "Experience the vibrant sights, sounds, and authentic rhythm of local neighborhoods.",
            cost: 10,
            mins: 90,
          },
          {
            title: "Evening Heritage Sound & Light Spectacle",
            desc: "Watch historic ramparts illuminate with dramatic narrations of the city's rich history.",
            cost: 12,
            mins: 75,
          },
        ],
        "Nature": [
          {
            title: "Heritage Parkland & Historic Botanical Gardens Walk",
            desc: "Stroll through tranquil landscaped gardens, shaded pavilions, and ancient tomb monuments.",
            cost: 5,
            mins: 90,
          },
          {
            title: "Serene Lakefront / River Promenade & Birdwatching",
            desc: "Unwind along peaceful water bodies home to migratory birds and scenic greenery.",
            cost: 0,
            mins: 90,
          },
        ],
        "Adventure": [
          {
            title: "Early Morning Heritage Bicycle Tour",
            desc: "Cycle through quiet morning streets and historic landmarks before the bustling day begins.",
            cost: 25,
            mins: 150,
          },
          {
            title: "Crafts Village & Artisan Pottery Workshop",
            desc: "Engage with traditional master weavers, potters, and folk artisans.",
            cost: 20,
            mins: 120,
          },
        ],
        "Shopping": [
          {
            title: "Handicrafts Emporium & Silk Market",
            desc: "Shop for handloom textiles, embroidered garments, brassware, and local souvenirs.",
            cost: 0,
            mins: 90,
          },
        ],
        "Relaxation": [
          {
            title: "Ayurvedic Wellness & Herbal Rejuvenation Session",
            desc: "Experience holistic therapeutic massage, herbal oils, and deep wellness relaxation.",
            cost: 35,
            mins: 120,
          },
        ],
      },
      defaultTemplates: [
        {
          title: "Heritage District Orientation Walk",
          desc: "Walk through iconic historic monuments and lively town bazaars.",
          cost: 0,
          mins: 90,
          category: "Sightseeing",
        },
        {
          title: "Traditional Regional Thali Lunch",
          desc: "Authentic multi-dish local meal highlighting regional spices and flavors.",
          cost: 15,
          mins: 75,
          category: "Food & Dining",
        },
        {
          title: "Historic Architectural Monument Visit",
          desc: "Centuries-old stone masonry and cultural heritage galleries.",
          cost: 10,
          mins: 120,
          category: "Culture & History",
        },
      ],
    };
  }

  // 4. Coastal / Tropical / Island
  if (
    /bali|phuket|bangkok|thailand|vietnam|hanoi|da nang|maldives|hawaii|cancun|caribbean|santorini|mykonos|ibiza|fiji|tahiti|seychelles|mauritius/i.test(
      place
    )
  ) {
    return {
      templates: {
        "Culture & History": [
          {
            title: "Coastal Temple & Sacred Sanctuary Visit",
            desc: "Explore cliffside shrines, intricate ceremonial gateways, and sacred oceanfront sites.",
            cost: 10,
            mins: 120,
          },
          {
            title: "Traditional Fishing Village & Cultural Center Walk",
            desc: "Learn about maritime heritage, traditional stilt houses, and local coastal life.",
            cost: 0,
            mins: 90,
          },
          {
            title: "Regional Folk Art & Island Heritage Gallery",
            desc: "Discover traditional wood carving, batik textiles, and island craftsmanship.",
            cost: 12,
            mins: 90,
          },
        ],
        "Food & Dining": [
          {
            title: "Fresh Coastal Seafood & Sunset Beach Dining",
            desc: "Taste freshly grilled seafood with aromatic herbs and sauces right along the shoreline.",
            cost: 30,
            mins: 100,
          },
          {
            title: "Tropical Fruit Market & Island Refreshment Stop",
            desc: "Sample exotic tropical fruits, fresh coconut water, and artisanal smoothies.",
            cost: 10,
            mins: 60,
          },
          {
            title: "Beachfront Café & Seaside Sunset Beverage",
            desc: "Sip refreshing drinks while enjoying warm sea breezes and panoramic ocean views.",
            cost: 15,
            mins: 60,
          },
        ],
        "Sightseeing": [
          {
            title: "Coastal Cliff Viewpoint & Ocean Panorama",
            desc: "Enjoy dramatic views of turquoise waters, sea arches, and crashing waves.",
            cost: 5,
            mins: 75,
          },
          {
            title: "Island Marina Promenade & Harbor Walk",
            desc: "Stroll past colorful sailboats, coastal boutiques, and lively boardwalk cafes.",
            cost: 0,
            mins: 75,
          },
          {
            title: "Twilight Beachfront Cultural Performance",
            desc: "Watch authentic island music and traditional evening dance performances.",
            cost: 20,
            mins: 75,
          },
        ],
        "Nature": [
          {
            title: "Lush Coastal Rain Forest & Waterfall Trail",
            desc: "Hike through lush jungle trails leading to serene hidden waterfalls and natural pools.",
            cost: 8,
            mins: 120,
          },
          {
            title: "Marine Nature Reserve & Coral Reef Walk",
            desc: "Explore shallow coral gardens, marine sanctuaries, and protected coastal wildlife.",
            cost: 15,
            mins: 120,
          },
        ],
        "Adventure": [
          {
            title: "Snorkeling & Coastal Water Sports Excursion",
            desc: "Swim among vibrant marine life and coral reefs in crystal-clear waters.",
            cost: 45,
            mins: 180,
          },
          {
            title: "Sunrise Coastal Kayaking or Paddleboard Adventure",
            desc: "Paddle along serene coves, hidden caves, and quiet morning shorelines.",
            cost: 35,
            mins: 120,
          },
        ],
        "Shopping": [
          {
            title: "Island Craft Market & Beachfront Boutiques",
            desc: "Browse woven bags, handmade jewelry, and local tropical souvenirs.",
            cost: 0,
            mins: 90,
          },
        ],
        "Relaxation": [
          {
            title: "Seaside Spa & Aromatherapy Massage",
            desc: "Recharge with soothing ocean sounds, coconut scrubs, and holistic wellness treatments.",
            cost: 40,
            mins: 90,
          },
        ],
      },
      defaultTemplates: [
        {
          title: "Coastal Promenade & Scenic Viewpoint",
          desc: "Walk along the waterfront with panoramic ocean vistas.",
          cost: 0,
          mins: 90,
          category: "Sightseeing",
        },
        {
          title: "Fresh Seafood Lunch by the Shore",
          desc: "Savor local ocean catches prepared with fresh regional spices.",
          cost: 25,
          mins: 75,
          category: "Food & Dining",
        },
        {
          title: "Historic Coastal Shrine & Cultural Site",
          desc: "Explore traditional architecture and sacred oceanfront monument.",
          cost: 10,
          mins: 90,
          category: "Culture & History",
        },
      ],
    };
  }

  // 5. East Asian
  if (
    /tokyo|kyoto|osaka|japan|seoul|korea|beijing|shanghai|taiwan|taipei|hong kong/i.test(
      place
    )
  ) {
    return {
      templates: {
        "Culture & History": [
          {
            title: "Ancient Shrine & Historic Temple Grounds Exploration",
            desc: "Wander through wooden pagoda gates, serene rock courtyards, and tranquil incense halls.",
            cost: 10,
            mins: 120,
          },
          {
            title: "Historic Traditional Quarter & Preservation District",
            desc: "Stroll past wooden townhouses, tea houses, and lantern-lit stone pathways.",
            cost: 0,
            mins: 120,
          },
          {
            title: "National Cultural Museum & Ceramic Arts Gallery",
            desc: "Discover centuries of calligraphy, historical artifacts, and delicate porcelain treasures.",
            cost: 15,
            mins: 120,
          },
        ],
        "Food & Dining": [
          {
            title: "Vibrant Food Alley & Night Market Tasting Tour",
            desc: "Sample savory dumplings, grilled skewers, noodle bowls, and sweet street treats.",
            cost: 25,
            mins: 90,
          },
          {
            title: "Authentic Local Dining & Regional Specialty Dinner",
            desc: "Enjoy a chef-crafted meal featuring authentic seasonal regional specialties.",
            cost: 35,
            mins: 90,
          },
          {
            title: "Traditional Tea Ceremony & Matcha Experience",
            desc: "Participate in a peaceful tea preparation ritual accompanied by seasonal confections.",
            cost: 25,
            mins: 60,
          },
        ],
        "Sightseeing": [
          {
            title: "Panoramic Tower Observation Deck & Skyline View",
            desc: "Gaze across the vast city expanse and distant mountains from iconic observation towers.",
            cost: 25,
            mins: 90,
          },
          {
            title: "Bustling Urban Plazas & Cultural Crossing Walk",
            desc: "Experience famous pedestrian plazas, lively districts, and kinetic city street life.",
            cost: 0,
            mins: 75,
          },
          {
            title: "Scenic Waterfront Bay & Island Park Walk",
            desc: "Stroll futuristic waterfront promenades and enjoy gentle coastal sea breezes.",
            cost: 0,
            mins: 75,
          },
        ],
        "Nature": [
          {
            title: "Landscaped Zen Garden & Serene Forest Sanctuary",
            desc: "Walk through bamboo groves, moss gardens, and historic shrine forest paths.",
            cost: 8,
            mins: 90,
          },
          {
            title: "Scenic Riverside Promenade & Tree-Lined Walk",
            desc: "Enjoy picturesque tree-lined paths along gentle flowing city waterways.",
            cost: 0,
            mins: 90,
          },
        ],
        "Adventure": [
          {
            title: "Guided Neighborhood Cycling Discovery",
            desc: "Pedal through backstreets, hidden residential alleys, and neighborhood parks.",
            cost: 30,
            mins: 150,
          },
          {
            title: "Traditional Crafts & Artisan Workshop",
            desc: "Create your own handmade keepsake under the guidance of a master artisan.",
            cost: 40,
            mins: 120,
          },
        ],
        "Shopping": [
          {
            title: "Traditional Craft Stalls & Modern Design Boutiques",
            desc: "Explore stationery, pottery, regional crafts, and unique local fashion.",
            cost: 0,
            mins: 90,
          },
        ],
        "Relaxation": [
          {
            title: "Traditional Onsen / Bathhouse Experience",
            desc: "Soak in hot natural mineral waters and experience rejuvenating tranquility.",
            cost: 25,
            mins: 120,
          },
        ],
      },
      defaultTemplates: [
        {
          title: "City Center & Landmark Exploration",
          desc: "Walk across historic avenues and vibrant cultural districts.",
          cost: 0,
          mins: 90,
          category: "Sightseeing",
        },
        {
          title: "Regional Specialty Lunch",
          desc: "Authentic local flavors and freshly prepared signature noodles.",
          cost: 20,
          mins: 75,
          category: "Food & Dining",
        },
        {
          title: "Historic Cultural Monument Discovery",
          desc: "Visit centuries-old shrine grounds and regional heritage treasures.",
          cost: 10,
          mins: 90,
          category: "Culture & History",
        },
      ],
    };
  }

  // 6. European / Western Classical
  if (
    /paris|rome|london|florence|venice|vienna|prague|madrid|barcelona|amsterdam|berlin|lisbon|budapest|munich|milan|dublin|edinburgh|switzerland/i.test(
      place
    )
  ) {
    return {
      templates: {
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
            title: "Historic Royal Palace & Architectural Landmark",
            desc: "Discover centuries-old royal residence halls, civic courtyards, and grand architecture.",
            cost: 20,
            mins: 120,
          },
        ],
        "Food & Dining": [
          {
            title: "Traditional Market Hall & Artisan Food Tasting",
            desc: "Sample regional cheeses, freshly baked breads, warm pastries, and local delicacies.",
            cost: 30,
            mins: 90,
          },
          {
            title: "Authentic Neighborhood Bistro / Trattoria Dinner",
            desc: "Savor chef-curated seasonal dishes paired with regional refreshments in a cozy setting.",
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
            desc: "Enjoy sweeping 360-degree aerial views of the city skyline and historic monuments.",
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
            desc: "Wander through landscaped formal gardens, arboretums, and quiet fountains.",
            cost: 10,
            mins: 90,
          },
          {
            title: "Scenic Nature Trail & Viewpoint Excursion",
            desc: "Hike well-marked natural paths with vistas of surrounding countryside and hills.",
            cost: 0,
            mins: 150,
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
            title: "Panoramic Funicular & Hilltop Viewpoint",
            desc: "Ascend historic hill railways for commanding views and picturesque hillside trails.",
            cost: 20,
            mins: 120,
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
      },
      defaultTemplates: [
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
      ],
    };
  }

  // 7. Universal / Global Neutral Fallback (works accurately for any global city without assumptions)
  return {
    templates: {
      "Culture & History": [
        {
          title: "Historic Old Town & Central Square Walking Tour",
          desc: "Explore local architectural landmarks, historic town squares, and civic monuments.",
          cost: 0,
          mins: 120,
        },
        {
          title: "Cultural Heritage & Fine Arts Museum",
          desc: "Visit renowned local exhibitions showcasing regional history, art, and cultural artifacts.",
          cost: 15,
          mins: 120,
        },
        {
          title: "Landmark Heritage Monument & Guided Exploration",
          desc: "Discover the city's foremost historic structure and learn its origins and stories.",
          cost: 15,
          mins: 120,
        },
      ],
      "Food & Dining": [
        {
          title: "Local Market Hall & Signature Dishes Tasting",
          desc: "Sample authentic local produce, regional signature snacks, and freshly prepared delicacies.",
          cost: 25,
          mins: 90,
        },
        {
          title: "Traditional Neighborhood Dining Experience",
          desc: "Savor authentic regional dishes prepared fresh at a well-regarded local establishment.",
          cost: 35,
          mins: 90,
        },
        {
          title: "Scenic Café & Traditional Beverage Tasting",
          desc: "Relax with artisanal local coffee, tea, and regional specialty refreshments.",
          cost: 12,
          mins: 60,
        },
      ],
      "Sightseeing": [
        {
          title: "Panoramic City Viewpoint & Scenic Lookout",
          desc: "Take in sweeping views of the city layout, surrounding landscape, and skyline.",
          cost: 15,
          mins: 90,
        },
        {
          title: "Historic Promenade & Iconic Waterfront Walk",
          desc: "Stroll along bustling central esplanades, civic plazas, and pedestrian thoroughfares.",
          cost: 0,
          mins: 75,
        },
        {
          title: "Evening Illuminated Monuments & Sunset Photography",
          desc: "Experience the city's landmarks bathed in evening light during the golden hour.",
          cost: 0,
          mins: 75,
        },
      ],
      "Nature": [
        {
          title: "City Botanical Parkland & Greenery Walk",
          desc: "Enjoy tranquil walking trails through mature shade trees, native plants, and water features.",
          cost: 5,
          mins: 90,
        },
        {
          title: "Scenic Nature Reserve & Hillside Walking Trail",
          desc: "Breathe fresh air along natural scenic pathways with panoramic lookouts.",
          cost: 0,
          mins: 120,
        },
      ],
      "Adventure": [
        {
          title: "Guided Neighborhood Discovery Walk or Cycling",
          desc: "Explore vibrant local districts, hidden streets, and cultural hotspots off the beaten track.",
          cost: 25,
          mins: 150,
        },
        {
          title: "Artisan Workshop & Craft Studio Visit",
          desc: "Learn firsthand about authentic local crafts, textiles, and traditional workmanship.",
          cost: 20,
          mins: 120,
        },
      ],
      "Shopping": [
        {
          title: "Artisan Boutiques & Historic Market Stalls",
          desc: "Browse independent local designers, handcrafted souvenirs, and regional specialties.",
          cost: 0,
          mins: 90,
        },
      ],
      "Relaxation": [
        {
          title: "Tranquil Wellness Retreat & Thermal Bath / Spa",
          desc: "Unwind with relaxing wellness facilities, peaceful lounges, and therapeutic treatments.",
          cost: 35,
          mins: 120,
        },
      ],
    },
    defaultTemplates: [
      {
        title: "City Highlights & Landmark Walk",
        desc: "Orientation walk across central avenues, historic squares, and gardens.",
        cost: 0,
        mins: 90,
        category: "Sightseeing",
      },
      {
        title: "Authentic Local Lunch Experience",
        desc: "Taste signature regional dishes at a popular neighborhood spot.",
        cost: 22,
        mins: 75,
        category: "Food & Dining",
      },
      {
        title: "Historic Cultural Monument Discovery",
        desc: "Visit the city's foremost cultural icon and learn its heritage.",
        cost: 15,
        mins: 100,
        category: "Culture & History",
      },
    ],
  };
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

  // Calculate comprehensive, destination-aware 5-pillar benchmark budget calibrated to user budget
  const benchmark = estimateTripBenchmarkBudget({
    destination: req.destination,
    startDate: req.startDate,
    endDate: req.endDate,
    totalDays,
    travelersCount: req.travelersCount,
    currency: req.currency,
    pace: req.pace,
    destinationsCount: destinations.length,
    userBudget: req.totalBudget,
  });

  // Scaling factor for activity templates based on benchmark activity cost in target currency
  const activityCostUnit = Math.max(1, Math.round(benchmark.breakdown.activities.dailyRatePerPerson / 3));

  const days: AIGeneratedDay[] = [];
  const visitedCities = new Set<string>();
  let prevCity = "";

  for (let d = 1; d <= totalDays; d++) {
    // Distribute destination stops evenly across days
    const destIndex = Math.min(
      Math.floor(((d - 1) / totalDays) * destinations.length),
      destinations.length - 1
    );
    const currentCity = destinations[destIndex];
    const currentDate = addDaysToDate(req.startDate, d - 1);
    const { templates, defaultTemplates } = getDestinationTemplates(req.destination, currentCity);

    const dayActivities: AIGeneratedActivity[] = [];

    // 1. Accommodation Check-in Item: On Day 1 of each new destination city
    if (!visitedCities.has(currentCity.toLowerCase())) {
      visitedCities.add(currentCity.toLowerCase());
      // Estimate nights in this city
      const cityNights = destinations.length > 1
        ? Math.max(1, Math.round(benchmark.nightsCount / destinations.length))
        : benchmark.nightsCount;
      const lodgingCost = Math.round(
        cityNights * benchmark.roomsCount * benchmark.breakdown.accommodation.nightlyRate
      );

      dayActivities.push({
        title: `Hotel Check-in & Accommodation in ${currentCity}`,
        description: `Lodging reservation for ${cityNights} night(s) in ${currentCity} (${benchmark.roomsCount} room(s))`,
        category: "Accommodation",
        startTime: "14:00",
        endTime: "15:00",
        durationMinutes: 60,
        estimatedCost: lodgingCost,
        isEstimated: true,
        recommendationReason: `Estimated lodging for ${cityNights} night(s) in ${currentCity} (${benchmark.roomsCount} room(s) @ ~${benchmark.primaryCurrency} ${benchmark.breakdown.accommodation.nightlyRate.toLocaleString()}/night).`,
      });
    }

    // 2. Intercity Transit Item: When moving to a new city on subsequent days
    if (d > 1 && prevCity && prevCity.toLowerCase() !== currentCity.toLowerCase()) {
      const perLegCost = Math.round(
        req.travelersCount *
          (benchmark.breakdown.transport.intercityTransit / Math.max(1, destinations.length - 1))
      );
      dayActivities.unshift({
        title: `Intercity Transit: ${prevCity} to ${currentCity}`,
        description: `Scheduled rail or transport transfer from ${prevCity} to ${currentCity}`,
        category: "Transport",
        startTime: "08:30",
        endTime: "11:00",
        durationMinutes: 150,
        estimatedCost: perLegCost,
        isEstimated: true,
        recommendationReason: `Estimated intercity transport transfer between ${prevCity} and ${currentCity} for ${req.travelersCount} traveler(s).`,
      });
    }

    prevCity = currentCity;

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

      // Scaled per-person cost accounting for traveler count and target currency
      const baseCost = picked.cost || 0;
      const scaledCostPerPerson = baseCost > 0
        ? Math.round(baseCost * (activityCostUnit / 20))
        : 0;
      const estCost = scaledCostPerPerson * Math.max(1, req.travelersCount);

      dayActivities.push({
        title: `${picked.title} in ${currentCity}`,
        description: picked.desc,
        category: interestCategory || "Sightseeing",
        startTime: slot.start,
        endTime: slot.end,
        durationMinutes: picked.mins || 90,
        estimatedCost: estCost,
        isEstimated: true,
        recommendationReason: `Planning estimate for ${req.pace} pacing matching your interest in ${interestCategory} (indicative estimate; not a guaranteed price).`,
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

  // Budget assessment based on the comprehensive 5-pillar benchmark
  const targetBudget = Number(req.totalBudget) || 0;
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
      totalEstimatedCost: benchmark.totalEstimatedCost,
      status: benchmark.status,
      isPreliminary: false,
      missingCategories: [],
      advice: benchmark.advice,
      breakdown: {
        accommodation: benchmark.breakdown.accommodation.total,
        food: benchmark.breakdown.food.total,
        transport: benchmark.breakdown.transport.total,
        activities: benchmark.breakdown.activities.total,
        contingencyBuffer: benchmark.breakdown.contingencyBuffer.total,
      },
      assumptions: benchmark.assumptions,
    },
    days,
    disclaimer:
      "All activity costs, durations, and timings are planning estimates. Real-time ticket prices, entry availability, and booking hours require independent verification before travel. GlobeTrotter does not present estimated costs as guaranteed live prices.",
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
4. Provide estimated costs per activity in ${req.currency} (number only, 0 for free parks/walking). Never claim live confirmed prices; all amounts are planning approximations.
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
            ...(model.includes("3") || model.includes("2.5") || model.includes("flash")
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
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

      // Group and normalize Gemini days to ensure valid 1..totalDays day sequence
      const rawDays: any[] = parsed.days;
      const daysByNumber = new Map<number, any>();

      // First pass: index by explicit dayNumber if valid (1..totalDays)
      for (const d of rawDays) {
        if (!d || typeof d !== "object") continue;
        const parsedNum = parseInt(String(d.dayNumber || "").replace(/\D/g, ""), 10);
        if (Number.isInteger(parsedNum) && parsedNum >= 1 && parsedNum <= totalDays) {
          if (!daysByNumber.has(parsedNum)) {
            daysByNumber.set(parsedNum, d);
          }
        }
      }

      // Second pass: fill unassigned slot positions from remaining raw days
      let unassignedIdx = 0;
      for (let d = 1; d <= totalDays; d++) {
        if (!daysByNumber.has(d)) {
          while (unassignedIdx < rawDays.length) {
            const candidate = rawDays[unassignedIdx++];
            if (candidate && typeof candidate === "object") {
              const candidateNum = parseInt(String(candidate.dayNumber || "").replace(/\D/g, ""), 10);
              // If candidate was already placed at its matching day, skip
              if (Number.isInteger(candidateNum) && daysByNumber.get(candidateNum) === candidate) {
                continue;
              }
              daysByNumber.set(d, candidate);
              break;
            }
          }
        }
      }

      // Check if Gemini provided at least half of the required days; if not, fail over safely to heuristic
      const minRequiredDays = totalDays <= 2 ? 1 : Math.ceil(totalDays / 2);
      if (daysByNumber.size < minRequiredDays) {
        throw new Error(
          `Gemini provided only ${daysByNumber.size} / ${totalDays} valid days. Failing over to heuristic planner.`
        );
      }

      // Prepare destination template fallback pool for filling any missing days or empty activity lists
      const rawDestList = req.destination
        .split(/[,&+]|\band\b/i)
        .map((s) => s.trim())
        .filter(Boolean);
      const destinationsList =
        Array.isArray(parsed.destinations) && parsed.destinations.length > 0
          ? parsed.destinations
          : rawDestList.length > 0
          ? rawDestList
          : [req.destination];

      const interests = req.interests.length > 0 ? req.interests : ["Sightseeing", "Food & Dining"];
      const activitiesPerDay =
        req.pace === "relaxed" ? 2 : req.pace === "fast-paced" ? 4 : 3;

      // Construct exactly totalDays (1..totalDays)
      const sanitizedDays: AIGeneratedDay[] = [];

      for (let d = 1; d <= totalDays; d++) {
        const destIndex = Math.min(
          Math.floor(((d - 1) / totalDays) * destinationsList.length),
          destinationsList.length - 1
        );
        const defaultCity = destinationsList[destIndex] || req.destination;
        const geminiDay = daysByNumber.get(d);
        const dayCity = String(geminiDay?.cityName || defaultCity).trim();

        let dayActivities: AIGeneratedActivity[] = [];

        if (geminiDay && Array.isArray(geminiDay.activities) && geminiDay.activities.length > 0) {
          dayActivities = geminiDay.activities.map((act: any) => ({
            title: String(act.title || "Curated Attraction").trim(),
            description: String(act.description || "").trim(),
            category: VALID_CATEGORIES.includes(act.category) ? act.category : "Sightseeing",
            startTime: String(act.startTime || "10:00").slice(0, 5),
            endTime: String(act.endTime || "12:00").slice(0, 5),
            durationMinutes: Number(act.durationMinutes) || 90,
            estimatedCost: Math.max(0, Number(act.estimatedCost) || 0),
            isEstimated: true,
            recommendationReason: String(
              act.recommendationReason ||
                "Matched with your trip interests (planning estimate; not a verified price)."
            ),
          }));
        }

        // If Gemini had no activities for this day or day was missing, fill with destination template
        if (dayActivities.length === 0) {
          const { templates, defaultTemplates } = getDestinationTemplates(req.destination, dayCity);
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

            dayActivities.push({
              title: `${picked.title} in ${dayCity}`,
              description: picked.desc,
              category: interestCategory || "Sightseeing",
              startTime: slot.start,
              endTime: slot.end,
              durationMinutes: picked.mins || 90,
              estimatedCost: estCost,
              isEstimated: true,
              recommendationReason: `Planning estimate matching your interest in ${interestCategory} (indicative estimate; not a guaranteed price).`,
            });
          }
        }

        sanitizedDays.push({
          dayNumber: d,
          date: addDaysToDate(req.startDate, d - 1),
          cityName: dayCity,
          theme: String(geminiDay?.theme || `Day ${d} Exploration`).trim(),
          activities: dayActivities,
        });
      }

      // Compute comprehensive 5-pillar benchmark calibrated to user budget
      const benchmark = estimateTripBenchmarkBudget({
        destination: req.destination,
        startDate: req.startDate,
        endDate: req.endDate,
        totalDays,
        travelersCount: req.travelersCount,
        currency: req.currency,
        pace: req.pace,
        destinationsCount: destinationsList.length,
        userBudget: req.totalBudget,
      });

      // Ensure Day 1 of each destination has accommodation if Gemini omitted lodging
      const hasAccommodation = sanitizedDays.some((d) =>
        d.activities.some(
          (a) =>
            /accommodat|hotel|hostel|lodging|resort/i.test(a.category || "") ||
            /accommodat|hotel|hostel|lodging|check-in/i.test(a.title)
        )
      );

      if (!hasAccommodation && sanitizedDays.length > 0) {
        const firstCity = destinationsList[0] || req.destination;
        const lodgingCost = Math.round(
          benchmark.nightsCount * benchmark.roomsCount * benchmark.breakdown.accommodation.nightlyRate
        );
        sanitizedDays[0].activities.unshift({
          title: `Hotel Check-in & Accommodation in ${firstCity}`,
          description: `Lodging reservation for ${benchmark.nightsCount} night(s) in ${firstCity} (${benchmark.roomsCount} room(s))`,
          category: "Accommodation",
          startTime: "14:00",
          endTime: "15:00",
          durationMinutes: 60,
          estimatedCost: lodgingCost,
          isEstimated: true,
          recommendationReason: `Estimated lodging for ${benchmark.nightsCount} night(s) in ${firstCity} (${benchmark.roomsCount} room(s) @ ~${benchmark.primaryCurrency} ${benchmark.breakdown.accommodation.nightlyRate.toLocaleString()}/night).`,
        });
      }

      const targetBudget = Number(req.totalBudget) || 0;

      return {
        tripTitle: String(parsed.tripTitle || `${req.destination} Adventure`).trim(),
        description: String(parsed.description || `Generated itinerary for ${req.destination}`).trim(),
        destinations: destinationsList,
        startDate: req.startDate,
        endDate: req.endDate,
        totalDays,
        targetBudget,
        currency: req.currency || "USD",
        budgetAssessment: {
          totalEstimatedCost: benchmark.totalEstimatedCost,
          status: benchmark.status,
          isPreliminary: false,
          missingCategories: [],
          advice: benchmark.advice,
          breakdown: {
            accommodation: benchmark.breakdown.accommodation.total,
            food: benchmark.breakdown.food.total,
            transport: benchmark.breakdown.transport.total,
            activities: benchmark.breakdown.activities.total,
            contingencyBuffer: benchmark.breakdown.contingencyBuffer.total,
          },
          assumptions: benchmark.assumptions,
        },
        days: sanitizedDays,
        disclaimer:
          "All activity costs, durations, and timings are planning estimates generated by Gemini. Real-time ticket prices, entry availability, and booking hours require independent verification before travel. GlobeTrotter does not present estimated costs as guaranteed live prices.",
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

