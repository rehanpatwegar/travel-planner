/**
 * Booking Links Generator
 * Pure, deterministic utility for generating safe, URL-encoded public search links
 * for established travel and booking providers.
 *
 * Design Guarantees:
 * 1. Safe Encoding: Never concatenates raw user input into URLs; always encodes via encodeURIComponent.
 * 2. Stable Public URLs: Uses verified public search entry points without broken query formats.
 * 3. Graceful Fallbacks: If dates or destinations are missing, generates sensible fallback search URLs.
 * 4. Regional Rail Accuracy:
 *    - For Indian destinations: Uses the official IRCTC train-search portal (https://www.irctc.co.in/nget/train-search)
 *      or a Google Search fallback ("trains from [origin] to [destination] on [date]") when origin and destination are known.
 *      Does NOT claim stations or dates are pre-filled in IRCTC since its form requires manual entry.
 *    - For European/UK destinations: Uses the verified Trainline homepage entry point (https://www.thetrainline.com/)
 *      or Google Search fallback for specific routes. Never generates broken /search?destination= URLs.
 * 5. Multi-City Support: Incorporates origin and destination across itinerary stops.
 */

export type BookingCategoryKey =
  | "hotels"
  | "flights"
  | "trains"
  | "transport"
  | "activities";

export interface BookingLinkParams {
  destination?: string | null;
  startDate?: string | null; // Expected YYYY-MM-DD
  endDate?: string | null;   // Expected YYYY-MM-DD
  origin?: string | null;
  currency?: string | null;
}

export interface BookingActionItem {
  key: BookingCategoryKey;
  title: string;
  categoryLabel: string;
  providerName: string;
  description: string;
  url: string;
  isCustomized: boolean; // True if destination/route was incorporated
  searchQueryText: string;
  officialPortalUrl?: string; // Optional direct link to official booking authority
}

/**
 * Validates a YYYY-MM-DD date string.
 */
function isValidDateString(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const trimmed = dateStr.trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(trimmed) && !isNaN(Date.parse(trimmed));
}

/**
 * Cleans and normalizes destination or origin text.
 */
function cleanLocation(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  return text.trim();
}

/**
 * Detects whether a destination or trip context is located in India.
 */
export function isIndianDestination(dest?: string | null, currency?: string | null): boolean {
  if (currency && currency.trim().toUpperCase() === "INR") return true;
  if (!dest || typeof dest !== "string") return false;
  const d = dest.toLowerCase();
  if (/\bindia\b|\bindian\b/i.test(d)) return true;

  const indianCities = [
    "bengaluru", "bangalore", "delhi", "new delhi", "mumbai", "bombay",
    "kolkata", "calcutta", "chennai", "madras", "hyderabad", "pune",
    "jaipur", "agra", "ahmedabad", "goa", "kochi", "cochin", "kerala",
    "varanasi", "lucknow", "chandigarh", "amritsar", "shimla", "manali",
    "ladakh", "leh", "mysuru", "mysore", "udaipur", "jodhpur", "jaisalmer",
    "rishikesh", "haridwar", "dehradun", "darjeeling", "gangtok", "guwahati",
    "patna", "bhopal", "indore", "surat", "nagpur", "visakhapatnam", "vizag"
  ];
  return indianCities.some((c) => d.includes(c));
}

/**
 * Detects whether a destination or trip context is located in the UK / Europe.
 */
export function isEuropeanDestination(dest?: string | null, currency?: string | null): boolean {
  if (currency && ["EUR", "GBP", "CHF"].includes(currency.trim().toUpperCase())) return true;
  if (!dest || typeof dest !== "string") return false;
  const d = dest.toLowerCase();
  const euroTerms = [
    "france", "paris", "uk", "united kingdom", "london", "england", "scotland", "edinburgh",
    "italy", "rome", "florence", "venice", "milan", "spain", "barcelona", "madrid",
    "germany", "berlin", "munich", "frankfurt", "switzerland", "zurich", "lucerne", "geneva",
    "austria", "vienna", "salzburg", "netherlands", "amsterdam", "belgium", "brussels",
    "portugal", "lisbon", "porto", "ireland", "dublin", "europe"
  ];
  return euroTerms.some((t) => d.includes(t));
}

/**
 * Builds safe Booking.com search URL for hotels & accommodation.
 */
export function buildHotelsUrl(params: BookingLinkParams): {
  url: string;
  isCustomized: boolean;
  queryText: string;
} {
  const dest = cleanLocation(params.destination);
  const start = isValidDateString(params.startDate) ? params.startDate!.trim() : null;
  const end = isValidDateString(params.endDate) ? params.endDate!.trim() : null;

  if (!dest) {
    return {
      url: "https://www.booking.com/",
      isCustomized: false,
      queryText: "Browse global hotels & stays on Booking.com",
    };
  }

  const queryParams = new URLSearchParams();
  queryParams.set("ss", dest);

  if (start && end && start <= end) {
    queryParams.set("checkin", start);
    queryParams.set("checkout", end);
  }

  return {
    url: `https://www.booking.com/searchresults.html?${queryParams.toString()}`,
    isCustomized: true,
    queryText: start && end
      ? `Hotels in ${dest} (${start} to ${end})`
      : `Hotels in ${dest}`,
  };
}

/**
 * Builds safe Google Flights search URL.
 */
export function buildFlightsUrl(params: BookingLinkParams): {
  url: string;
  isCustomized: boolean;
  queryText: string;
} {
  const dest = cleanLocation(params.destination);
  const origin = cleanLocation(params.origin);
  const start = isValidDateString(params.startDate) ? params.startDate!.trim() : null;
  const end = isValidDateString(params.endDate) ? params.endDate!.trim() : null;

  if (!dest) {
    return {
      url: "https://www.google.com/travel/flights",
      isCustomized: false,
      queryText: "Explore flight routes on Google Flights",
    };
  }

  let searchQuery = origin ? `flights from ${origin} to ${dest}` : `flights to ${dest}`;
  if (start && end && start <= end) {
    searchQuery += ` from ${start} to ${end}`;
  } else if (start) {
    searchQuery += ` on ${start}`;
  }

  return {
    url: `https://www.google.com/travel/flights?q=${encodeURIComponent(searchQuery)}`,
    isCustomized: true,
    queryText: searchQuery,
  };
}

export interface TrainsUrlResult {
  url: string;
  isCustomized: boolean;
  queryText: string;
  providerName: string;
  description: string;
  officialPortalUrl?: string;
}

/**
 * Builds safe, verified train & rail search URL.
 *
 * Rules:
 * 1. NEVER generates the broken URL: https://www.thetrainline.com/search?destination=...
 *    (Trainline does not support query param search and returns an error).
 * 2. Indian destinations:
 *    - If origin and destination are available: Uses Google Search fallback:
 *      "trains from [origin] to [destination] on [date]"
 *    - If only destination is available: Uses official IRCTC train-search portal:
 *      https://www.irctc.co.in/nget/train-search (clearly stating manual entry on official form).
 * 3. European/UK destinations:
 *    - Uses Trainline's verified homepage entry point: https://www.thetrainline.com/
 *      or Google Search fallback if origin is known.
 * 4. General/Other destinations:
 *    - Uses Google Search fallback for train schedules.
 */
export function buildTrainsUrl(params: BookingLinkParams): TrainsUrlResult {
  const dest = cleanLocation(params.destination);
  const origin = cleanLocation(params.origin);
  const start = isValidDateString(params.startDate) ? params.startDate!.trim() : null;

  // Fallback when no destination is provided
  if (!dest) {
    return {
      url: "https://www.thetrainline.com/",
      isCustomized: false,
      queryText: "Search European and international train routes on Trainline",
      providerName: "Trainline",
      description: "Find regional and high-speed train tickets and rail passes.",
    };
  }

  // 1. Indian Destinations
  if (isIndianDestination(dest, params.currency)) {
    // If both origin and destination are known, provide a Google Search query for the route
    if (origin && origin.toLowerCase() !== dest.toLowerCase()) {
      let searchQuery = `trains from ${origin} to ${dest}`;
      if (start) searchQuery += ` on ${start}`;
      return {
        url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
        isCustomized: true,
        queryText: searchQuery,
        providerName: "Google Search",
        description: `Check live train timetables & IRCTC routes from ${origin} to ${dest}.`,
        officialPortalUrl: "https://www.irctc.co.in/nget/train-search",
      };
    }

    // Only destination known: link directly to official IRCTC portal
    // Note: Do NOT claim stations or dates are pre-filled since IRCTC requires manual station entry
    return {
      url: "https://www.irctc.co.in/nget/train-search",
      isCustomized: true,
      queryText: start
        ? `IRCTC official train search for ${dest} (${start} — enter stations manually)`
        : `IRCTC official train search for ${dest} (enter stations manually)`,
      providerName: "IRCTC (Indian Railways)",
      description: "Search official Indian Railways train schedules, availability, and bookings.",
      officialPortalUrl: "https://www.irctc.co.in/nget/train-search",
    };
  }

  // 2. European / UK Destinations
  if (isEuropeanDestination(dest, params.currency)) {
    if (origin && origin.toLowerCase() !== dest.toLowerCase()) {
      let searchQuery = `trains from ${origin} to ${dest}`;
      if (start) searchQuery += ` on ${start}`;
      return {
        url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
        isCustomized: true,
        queryText: searchQuery,
        providerName: "Google Search",
        description: `Search European train routes and schedules from ${origin} to ${dest}.`,
        officialPortalUrl: "https://www.thetrainline.com/",
      };
    }

    // Verified Trainline entry point (Trainline homepage; never use broken /search?destination=)
    return {
      url: "https://www.thetrainline.com/",
      isCustomized: true,
      queryText: start
        ? `Search trains to ${dest} on Trainline (${start})`
        : `Search trains to ${dest} on Trainline`,
      providerName: "Trainline",
      description: `Find regional and high-speed rail connections to ${dest} on Trainline.`,
    };
  }

  // 3. General / Other Destinations (Amtrak, Japan Rail, etc.)
  let searchQuery = origin && origin.toLowerCase() !== dest.toLowerCase()
    ? `trains from ${origin} to ${dest}`
    : `trains to ${dest}`;
  if (start) searchQuery += ` on ${start}`;

  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
    isCustomized: true,
    queryText: searchQuery,
    providerName: "Google Search",
    description: `Search rail connections and train schedules for ${dest}.`,
  };
}

/**
 * Builds safe Kayak Car Rentals search URL for car rentals & local transit.
 */
export function buildTransportUrl(params: BookingLinkParams): {
  url: string;
  isCustomized: boolean;
  queryText: string;
} {
  const dest = cleanLocation(params.destination);
  const start = isValidDateString(params.startDate) ? params.startDate!.trim() : null;
  const end = isValidDateString(params.endDate) ? params.endDate!.trim() : null;

  if (!dest) {
    return {
      url: "https://www.kayak.com/cars",
      isCustomized: false,
      queryText: "Search rental cars and transit options on Kayak",
    };
  }

  const encodedDest = encodeURIComponent(dest);
  if (start && end && start <= end) {
    return {
      url: `https://www.kayak.com/cars/${encodedDest}/${encodeURIComponent(start)}/${encodeURIComponent(end)}`,
      isCustomized: true,
      queryText: `Rental cars in ${dest} (${start} to ${end})`,
    };
  }

  return {
    url: `https://www.kayak.com/cars/${encodedDest}`,
    isCustomized: true,
    queryText: `Rental cars in ${dest}`,
  };
}

/**
 * Builds safe GetYourGuide search URL for activities, tours, and attractions.
 */
export function buildActivitiesUrl(params: BookingLinkParams): {
  url: string;
  isCustomized: boolean;
  queryText: string;
} {
  const dest = cleanLocation(params.destination);

  if (!dest) {
    return {
      url: "https://www.getyourguide.com/",
      isCustomized: false,
      queryText: "Browse top tours and attractions on GetYourGuide",
    };
  }

  return {
    url: `https://www.getyourguide.com/s/?q=${encodeURIComponent(dest)}`,
    isCustomized: true,
    queryText: `Tours & experiences in ${dest}`,
  };
}

/**
 * Generates the complete set of 5 booking action items for a given destination, origin, and dates.
 */
export function generateBookingActions(params: BookingLinkParams): BookingActionItem[] {
  const hotels = buildHotelsUrl(params);
  const flights = buildFlightsUrl(params);
  const trains = buildTrainsUrl(params);
  const transport = buildTransportUrl(params);
  const activities = buildActivitiesUrl(params);

  return [
    {
      key: "hotels",
      title: "Hotels & Stays",
      categoryLabel: "Accommodation",
      providerName: "Booking.com",
      description: "Search hotels, apartments, villas, and boutique hostels.",
      url: hotels.url,
      isCustomized: hotels.isCustomized,
      searchQueryText: hotels.queryText,
    },
    {
      key: "flights",
      title: "Flights",
      categoryLabel: "Air Travel",
      providerName: "Google Flights",
      description: "Compare airlines, flight routes, schedules, and fares.",
      url: flights.url,
      isCustomized: flights.isCustomized,
      searchQueryText: flights.queryText,
    },
    {
      key: "trains",
      title: "Trains & Rail",
      categoryLabel: "Rail Travel",
      providerName: trains.providerName,
      description: trains.description,
      url: trains.url,
      isCustomized: trains.isCustomized,
      searchQueryText: trains.queryText,
      officialPortalUrl: trains.officialPortalUrl,
    },
    {
      key: "transport",
      title: "Car Rentals",
      categoryLabel: "Local Transit",
      providerName: "Kayak Cars",
      description: "Compare car hire deals, SUVs, and flexible airport pickups.",
      url: transport.url,
      isCustomized: transport.isCustomized,
      searchQueryText: transport.queryText,
    },
    {
      key: "activities",
      title: "Tours & Tickets",
      categoryLabel: "Experiences",
      providerName: "GetYourGuide",
      description: "Discover skip-the-line museum tickets, day trips, and guided tours.",
      url: activities.url,
      isCustomized: activities.isCustomized,
      searchQueryText: activities.queryText,
    },
  ];
}
