"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  MapPin,
  DollarSign,
  Star,
  Compass,
  ArrowLeft,
  Layers,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface City {
  id: string;
  name: string;
  country: string;
  country_code?: string;
  region?: string;
  description?: string;
  image_url?: string;
  average_daily_cost: number;
  currency: string;
  rating?: number;
  is_popular?: boolean;
}

function SearchCitiesContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");

  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  async function loadCities(showRefreshing = false) {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await fetch("/api/cities", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCities(data);
      }
    } catch (err) {
      console.error("Failed to load cities", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadCities();
  }, []);

  const regions = [
    "All",
    ...Array.from(new Set(cities.map((c) => c.region).filter(Boolean) as string[])),
  ];

  const filteredCities = cities.filter((city) => {
    const matchesSearch =
      city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      city.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = selectedRegion === "All" || city.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  async function handleAddStopToTrip(city: City) {
    if (!tripId) return;
    setAddingId(city.id);
    const isRealCityUuid =
      city.id &&
      !(city as any).is_fallback &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        city.id
      );

    try {
      const res = await fetch(`/api/trips/${tripId}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city_id: isRealCityUuid ? city.id : null,
          custom_city_name: city.name,
        }),
      });
      if (res.ok) {
        setAddedIds((prev) => ({ ...prev, [city.id]: true }));
      }
    } catch (err) {
      console.error("Failed to add stop:", err);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {tripId ? (
              <Link
                href={`/trips/${tripId}/builder`}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Builder
              </Link>
            ) : (
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Compass className="h-4 w-4" />
                </div>
                <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
              </Link>
            )}
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-600">Explore Cities</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing || loading}
              onClick={() => loadCities(true)}
              className="gap-1.5 text-xs text-slate-600 hover:text-slate-900"
              title="Refresh city catalog"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Link href={tripId ? `/search/activities?tripId=${tripId}` : "/search/activities"}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" />
                Browse Activities
              </Button>
            </Link>
            {tripId ? (
              <Link href={`/trips/${tripId}/builder`}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Return to Builder
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        {tripId && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                Adding destinations to your trip route. Click <strong>&quot;Add to Route&quot;</strong> on any destination to add it as a stop.
              </span>
            </div>
            <Link href={`/trips/${tripId}/builder`}>
              <Button size="sm" className="text-xs h-7 bg-blue-600 text-white">
                View Builder
              </Button>
            </Link>
          </div>
        )}

        {/* Page Title & Search Bar */}
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
            Curated Global Destinations
          </Badge>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Search Destinations
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Find iconic cities and hidden gems with accurate daily cost estimates, location insights, and key travel highlights.
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] text-slate-500 shadow-2xs">
            <Info className="h-3 w-3 text-slate-400 shrink-0" />
            <span>Curated catalog destinations. Custom stops added within individual trips remain private to those itineraries.</span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by city name, country, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white text-sm shadow-xs border-slate-200"
              />
            </div>
          </div>

          {/* Region Filter Pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
            {regions.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setSelectedRegion(region)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedRegion === region
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        {/* Cities Grid */}
        <div className="mt-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-3 text-sm">Loading destinations...</p>
            </div>
          ) : filteredCities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <MapPin className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-2 text-sm font-semibold text-slate-900">No destinations found</h3>
              <p className="mt-1 text-xs text-slate-500">
                Try adjusting your search query or selecting a different region.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCities.map((city) => (
                <Card
                  key={city.id}
                  className="group flex flex-col justify-between overflow-hidden border-slate-200 bg-white transition-all hover:border-blue-200 hover:shadow-md"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    <img
                      src={city.image_url || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80"}
                      alt={city.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      {city.is_popular && (
                        <Badge className="bg-amber-500 text-white text-[10px] font-semibold shadow-sm">
                          Popular
                        </Badge>
                      )}
                      {city.region && (
                        <Badge className="bg-slate-900/80 text-white text-[10px] font-semibold backdrop-blur-sm shadow-sm">
                          {city.region}
                        </Badge>
                      )}
                    </div>
                    {city.rating && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-sm">
                        <Star className="h-3 w-3 fill-amber-300" />
                        <span>{city.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {city.name}
                        </h3>
                        <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {city.country}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Avg. Daily</span>
                        <span className="text-sm font-bold text-emerald-600">
                          ${city.average_daily_cost.toFixed(0)} <span className="text-[10px] text-slate-500 font-normal">/day</span>
                        </span>
                      </div>
                    </div>

                    {city.description && (
                      <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {city.description}
                      </p>
                    )}

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <Link
                        href={`/search/activities?city=${encodeURIComponent(city.name)}${tripId ? `&tripId=${tripId}` : ""}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        View Activities →
                      </Link>

                      {tripId ? (
                        addedIds[city.id] ? (
                          <Button disabled size="sm" className="text-xs h-8 bg-emerald-600 text-white gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Added
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={addingId === city.id}
                            onClick={() => handleAddStopToTrip(city)}
                            className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {addingId === city.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Add to Route"
                            )}
                          </Button>
                        )
                      ) : (
                        <Link href={`/trips/new?city=${encodeURIComponent(city.name)}`}>
                          <Button size="sm" variant="outline" className="text-xs h-8">
                            Add to Trip
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SearchCitiesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <SearchCitiesContent />
    </Suspense>
  );
}
