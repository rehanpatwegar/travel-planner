/**
 * Verification Script for Feature: Booking Links
 * Tests safe URL generation, date formatting, multi-city legs,
 * fallback URLs, special character encoding, and regional rail routing.
 *
 * Verifies Issue 1 requirements:
 * - Trainline never opens the known broken URL (thetrainline.com/search?destination=...)
 * - Indian destinations route to official IRCTC (https://www.irctc.co.in/nget/train-search)
 * - Origin + destination journeys route to safe Google Search rail queries
 * - Supported UK/European journeys use verified Trainline entry points
 *
 * Execution:
 * node --experimental-strip-types scripts/verify-booking-links.mjs
 */

import {
  buildHotelsUrl,
  buildFlightsUrl,
  buildTrainsUrl,
  buildTransportUrl,
  buildActivitiesUrl,
  generateBookingActions,
  isIndianDestination,
  isEuropeanDestination,
} from "../lib/booking/bookingLinks.ts";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${message}`);
  }
}

console.log("=================================================================");
console.log("GlobeTrotter — Booking Links Verification Suite");
console.log("=================================================================\n");

// -----------------------------------------------------------------------------
// Test 1: Complete Destination and Date Parameters (European Journey)
// -----------------------------------------------------------------------------
console.log("Test 1: Standard Trip with Destination and Dates (Paris)");
{
  const params = {
    destination: "Paris",
    startDate: "2026-11-01",
    endDate: "2026-11-07",
  };

  const hotels = buildHotelsUrl(params);
  assert(hotels.isCustomized === true, "Hotels marked as customized");
  assert(hotels.url.includes("booking.com/searchresults.html"), "Hotels targets Booking.com searchresults");
  assert(hotels.url.includes("ss=Paris"), "Hotels encodes destination parameter ss=Paris");
  assert(hotels.url.includes("checkin=2026-11-01"), "Hotels includes checkin date");
  assert(hotels.url.includes("checkout=2026-11-07"), "Hotels includes checkout date");

  const flights = buildFlightsUrl(params);
  assert(flights.isCustomized === true, "Flights marked as customized");
  assert(flights.url.includes("google.com/travel/flights"), "Flights targets Google Flights");
  assert(flights.url.includes("flights%20to%20Paris") || flights.url.includes("flights+to+Paris"), "Flights encodes search query text");
  assert(flights.url.includes("2026-11-01") && flights.url.includes("2026-11-07"), "Flights includes start and end dates");

  const trains = buildTrainsUrl(params);
  assert(trains.isCustomized === true, "Trains marked as customized");
  assert(!trains.url.includes("thetrainline.com/search"), "Trains NEVER generates broken thetrainline.com/search URL");
  assert(trains.url === "https://www.thetrainline.com/", "European train without origin safely uses Trainline homepage");
  assert(trains.providerName === "Trainline", "Provider is Trainline");

  const cars = buildTransportUrl(params);
  assert(cars.isCustomized === true, "Cars marked as customized");
  assert(cars.url.includes("kayak.com/cars/Paris/2026-11-01/2026-11-07"), "Cars includes destination and date range path");

  const activities = buildActivitiesUrl(params);
  assert(activities.isCustomized === true, "Activities marked as customized");
  assert(activities.url.includes("getyourguide.com/s/"), "Activities targets GetYourGuide search");
  assert(activities.url.includes("q=Paris"), "Activities includes query param q=Paris");
}

// -----------------------------------------------------------------------------
// Test 2: Destination Without Dates (Flexible Travel)
// -----------------------------------------------------------------------------
console.log("\nTest 2: Destination Without Dates (Flexible Dates)");
{
  const params = {
    destination: "Rome",
    startDate: null,
    endDate: null,
  };

  const hotels = buildHotelsUrl(params);
  assert(hotels.isCustomized === true, "Hotels customized for Rome");
  assert(hotels.url.includes("ss=Rome"), "Hotels includes destination Rome");
  assert(!hotels.url.includes("checkin="), "Hotels omits checkin when date is null");
  assert(!hotels.url.includes("checkout="), "Hotels omits checkout when date is null");

  const flights = buildFlightsUrl(params);
  assert(flights.isCustomized === true, "Flights customized for Rome");
  assert(!flights.url.includes("from"), "Flights omits date query when dates absent");

  const trains = buildTrainsUrl(params);
  assert(trains.isCustomized === true, "Trains customized for Rome");
  assert(!trains.url.includes("thetrainline.com/search"), "Trains omits broken search parameter URL");
  assert(trains.url === "https://www.thetrainline.com/", "Trains uses Trainline homepage entry point");

  const cars = buildTransportUrl(params);
  assert(cars.url.endsWith("/cars/Rome"), "Cars uses general city search path without dates");

  const activities = buildActivitiesUrl(params);
  assert(activities.url.includes("q=Rome"), "Activities includes destination Rome");
}

// -----------------------------------------------------------------------------
// Test 3: Regional Rail Routing — India (IRCTC & Google Search Fallback)
// -----------------------------------------------------------------------------
console.log("\nTest 3: Regional Rail Routing — Indian Destinations (Bengaluru)");
{
  // Case A: Indian destination without origin -> Official IRCTC portal
  const indianParams = {
    destination: "Bengaluru",
    startDate: "2026-10-24",
    currency: "INR",
  };

  assert(isIndianDestination(indianParams.destination, indianParams.currency) === true, "Detects Bengaluru as Indian destination");

  const trainsBengaluru = buildTrainsUrl(indianParams);
  assert(!trainsBengaluru.url.includes("thetrainline.com"), "Indian destination does NOT route to Trainline");
  assert(trainsBengaluru.url === "https://www.irctc.co.in/nget/train-search", "Indian destination routes to official IRCTC train-search portal");
  assert(trainsBengaluru.providerName === "IRCTC (Indian Railways)", "Provider correctly labeled as IRCTC");
  assert(trainsBengaluru.queryText.includes("enter stations manually"), "Transparently notes manual entry required on official portal");

  // Case B: Indian destination WITH origin -> Google Search fallback with route query
  const indianRouteParams = {
    destination: "Bengaluru",
    origin: "Chennai",
    startDate: "2026-10-24",
    currency: "INR",
  };

  const trainsRoute = buildTrainsUrl(indianRouteParams);
  assert(trainsRoute.url.includes("google.com/search"), "Route with origin routes to Google Search fallback");
  assert(trainsRoute.url.includes("trains%20from%20Chennai%20to%20Bengaluru") || trainsRoute.url.includes("trains+from+Chennai+to+Bengaluru"), "Google Search includes encoded origin and destination");
  assert(trainsRoute.url.includes("2026-10-24"), "Google Search query includes date");
  assert(trainsRoute.providerName === "Google Search", "Provider labeled as Google Search");
  assert(trainsRoute.officialPortalUrl === "https://www.irctc.co.in/nget/train-search", "Provides direct link to official IRCTC portal");

  // Case C: Action items array properly populates
  const actions = generateBookingActions(indianRouteParams);
  const trainAction = actions.find((a) => a.key === "trains");
  assert(trainAction !== undefined, "Train action generated");
  assert(trainAction.officialPortalUrl === "https://www.irctc.co.in/nget/train-search", "Action item contains officialPortalUrl");
  assert(!trainAction.url.includes("thetrainline.com/search"), "Action URL is not broken Trainline search");
}

// -----------------------------------------------------------------------------
// Test 4: European Route with Origin & Destination
// -----------------------------------------------------------------------------
console.log("\nTest 4: European Route with Origin & Destination (London to Paris)");
{
  const euroRouteParams = {
    origin: "London",
    destination: "Paris",
    startDate: "2026-11-01",
    currency: "GBP",
  };

  assert(isEuropeanDestination(euroRouteParams.destination, euroRouteParams.currency) === true, "Detects Paris as European destination");

  const euroTrains = buildTrainsUrl(euroRouteParams);
  assert(!euroTrains.url.includes("thetrainline.com/search"), "Never uses broken /search?destination= URL");
  assert(euroTrains.url.includes("google.com/search"), "Routes to Google Search for specific origin-destination pair");
  assert(euroTrains.url.includes("trains%20from%20London%20to%20Paris") || euroTrains.url.includes("trains+from+London+to+Paris"), "Encodes route correctly");
  assert(euroTrains.officialPortalUrl === "https://www.thetrainline.com/", "Provides verified Trainline homepage as official portal");
}

// -----------------------------------------------------------------------------
// Test 5: Special Characters, Accents, and Spaces Encoding
// -----------------------------------------------------------------------------
console.log("\nTest 5: Special Characters and Non-ASCII Encodings");
{
  const complexDestinations = [
    { name: "São Paulo", expectedEncoded: "S%C3%A3o%20Paulo" },
    { name: "Zürich", expectedEncoded: "Z%C3%BCrich" },
    { name: "New York & New Jersey", expectedEncoded: "New%20York%20%26%20New%20Jersey" },
    { name: "King's Cross / London", expectedEncoded: encodeURIComponent("King's Cross / London") },
  ];

  for (const item of complexDestinations) {
    const actions = generateBookingActions({ destination: item.name });
    for (const action of actions) {
      assert(!action.url.includes(" "), `No raw unencoded spaces in ${action.key} URL for "${item.name}"`);
      assert(action.url.startsWith("https://"), `${action.key} URL starts with https:// for "${item.name}"`);
      assert(!action.url.includes("thetrainline.com/search?destination="), `Train URL is not broken Trainline search for "${item.name}"`);
    }
    const act = buildActivitiesUrl({ destination: item.name });
    assert(act.url.includes(item.expectedEncoded), `GetYourGuide correctly encoded "${item.name}" as ${item.expectedEncoded}`);
  }
}

// -----------------------------------------------------------------------------
// Test 6: Missing or Empty Destination Fallbacks
// -----------------------------------------------------------------------------
console.log("\nTest 6: Missing or Empty Destination Fallbacks");
{
  const emptyParamsList = [
    { destination: null },
    { destination: undefined },
    { destination: "" },
    { destination: "   " },
  ];

  for (const emptyParams of emptyParamsList) {
    const actions = generateBookingActions(emptyParams);
    assert(actions.length === 5, "Returns exactly 5 booking actions on empty destination");

    for (const a of actions) {
      assert(a.isCustomized === false, `${a.key} flagged as not customized (fallback mode)`);
      assert(a.url.startsWith("https://"), `${a.key} fallback URL is a valid https:// link`);
      assert(!a.url.includes("thetrainline.com/search"), `${a.key} does not contain broken Trainline search URL`);
    }
  }

  const hotelsFallback = buildHotelsUrl({ destination: "" });
  assert(hotelsFallback.url === "https://www.booking.com/", "Hotels falls back to Booking.com homepage");

  const flightsFallback = buildFlightsUrl({ destination: null });
  assert(flightsFallback.url === "https://www.google.com/travel/flights", "Flights falls back to Google Flights homepage");

  const trainsFallback = buildTrainsUrl({ destination: undefined });
  assert(trainsFallback.url === "https://www.thetrainline.com/", "Trains falls back to Trainline homepage");

  const carsFallback = buildTransportUrl({ destination: "   " });
  assert(carsFallback.url === "https://www.kayak.com/cars", "Cars falls back to Kayak cars homepage");

  const actFallback = buildActivitiesUrl({ destination: null });
  assert(actFallback.url === "https://www.getyourguide.com/", "Activities falls back to GetYourGuide homepage");
}

// -----------------------------------------------------------------------------
// Test 7: Inverted or Invalid Date Handling
// -----------------------------------------------------------------------------
console.log("\nTest 7: Inverted or Malformed Dates");
{
  const invertedParams = {
    destination: "Tokyo",
    startDate: "2026-11-10",
    endDate: "2026-11-01", // End before start
  };

  const hotels = buildHotelsUrl(invertedParams);
  assert(!hotels.url.includes("checkin="), "Hotels safely omits checkin when dates are inverted");

  const malformedParams = {
    destination: "Tokyo",
    startDate: "invalid-date",
    endDate: "2026-99-99",
  };

  const flights = buildFlightsUrl(malformedParams);
  assert(!flights.url.includes("invalid-date"), "Flights safely rejects malformed date string");
}

// -----------------------------------------------------------------------------
// Test 8: Multi-City Legs Isolation
// -----------------------------------------------------------------------------
console.log("\nTest 8: Multi-City Legs Generation");
{
  const stops = [
    { city: "Paris", arrival: "2026-11-01", departure: "2026-11-04" },
    { city: "Florence", arrival: "2026-11-04", departure: "2026-11-07" },
  ];

  const leg1Actions = generateBookingActions({
    destination: stops[0].city,
    startDate: stops[0].arrival,
    endDate: stops[0].departure,
  });

  const leg2Actions = generateBookingActions({
    origin: stops[0].city,
    destination: stops[1].city,
    startDate: stops[1].arrival,
    endDate: stops[1].departure,
  });

  const leg1Hotels = leg1Actions.find((a) => a.key === "hotels");
  const leg2Hotels = leg2Actions.find((a) => a.key === "hotels");
  const leg2Trains = leg2Actions.find((a) => a.key === "trains");

  assert(leg1Hotels.url.includes("ss=Paris"), "Leg 1 targets Paris");
  assert(leg1Hotels.url.includes("checkin=2026-11-01"), "Leg 1 checkin is 2026-11-01");

  assert(leg2Hotels.url.includes("ss=Florence"), "Leg 2 targets Florence");
  assert(leg2Hotels.url.includes("checkin=2026-11-04"), "Leg 2 checkin is 2026-11-04");

  assert(leg2Trains.url.includes("Paris") && leg2Trains.url.includes("Florence"), "Leg 2 train links incorporates Paris origin and Florence destination");
}

console.log("\n=================================================================");
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log("=================================================================");

if (failedCount > 0) {
  process.exit(1);
}
