"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, DollarSign, Clock, Star, Compass, Tag, Layers, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Activity {
  id: string;
  title: string;
  city_name?: string;
  country?: string;
  description?: string;
  category: string;
  estimated_cost: number;
  currency: string;
  duration_minutes: number;
  rating?: number;
  address?: string;
  image_url?: string;
}

export default function SearchActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    async function loadActivities() {
      try {
        const res = await fetch("/api/activities");
        if (res.ok) {
          const data = await res.json();
          setActivities(data);
        }
      } catch (err) {
        console.error("Failed to load activities", err);
      } finally {
        setLoading(false);
      }
    }
    loadActivities();
  }, []);

  const categories = [
    "All",
    ...Array.from(new Set(activities.map((a) => a.category).filter(Boolean))),
  ];

  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (act.city_name && act.city_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (act.description && act.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === "All" || act.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Compass className="h-4 w-4" />
              </div>
              <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-600">Explore Activities</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/search/cities">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" />
                Browse Cities
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        {/* Title & Search */}
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-xs">
            Curated Experiences & Attractions
          </Badge>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Browse Travel Activities
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Discover attractions, food tours, museum walks, and outdoor adventures with cost & duration badges.
          </p>

          {/* Search Box */}
          <div className="relative mt-6">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search activities by name, destination, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white border-slate-200 text-sm shadow-sm"
            />
          </div>

          {/* Category Filter Chips */}
          {categories.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Activities Grid */}
        <div className="mt-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-sm font-medium">Loading activities catalog...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Layers className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">No activities found</h3>
              <p className="mt-1 text-xs text-slate-500">
                No activities match &ldquo;{searchQuery}&rdquo;. Try another search term or reset category filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="mt-4"
              >
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredActivities.map((act) => (
                <Card
                  key={act.id}
                  className="group flex flex-col justify-between overflow-hidden border-slate-200 bg-white transition-all hover:border-blue-200 hover:shadow-lg"
                >
                  <div>
                    {/* Activity Image */}
                    <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                      <img
                        src={act.image_url || "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80"}
                        alt={act.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <Badge className="bg-slate-900/80 text-white text-[10px] font-semibold backdrop-blur-sm shadow-sm">
                          {act.category}
                        </Badge>
                      </div>
                      {act.rating && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-sm">
                          <Star className="h-3 w-3 fill-amber-300" />
                          <span>{act.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-5">
                      {act.city_name && (
                        <div className="flex items-center gap-1 text-xs font-medium text-blue-600 mb-1">
                          <MapPin className="h-3 w-3" />
                          {act.city_name} {act.country ? `• ${act.country}` : ""}
                        </div>
                      )}

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {act.title}
                      </h3>

                      {act.description && (
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {act.description}
                        </p>
                      )}

                      {/* Badges for Cost and Duration */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                          <DollarSign className="h-3 w-3" />
                          {act.estimated_cost === 0 ? "Free Activity" : `$${act.estimated_cost.toFixed(0)} est.`}
                        </Badge>
                        <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700 text-xs">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {act.duration_minutes >= 60
                            ? `${Math.floor(act.duration_minutes / 60)}h ${act.duration_minutes % 60 ? `${act.duration_minutes % 60}m` : ""}`
                            : `${act.duration_minutes} min`}
                        </Badge>
                      </div>
                    </CardContent>
                  </div>

                  <div className="p-5 pt-0">
                    <Link href={`/trips/new`}>
                      <Button className="w-full text-xs h-9 bg-slate-900 hover:bg-blue-600 text-white transition-colors">
                        Add to Itinerary
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

