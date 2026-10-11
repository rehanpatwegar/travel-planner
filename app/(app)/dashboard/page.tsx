import Link from "next/link";
import {
  Compass,
  Plus,
  MapPin,
  Calendar,
  DollarSign,
  Route,
  Sparkles,
  ArrowRight,
  Share2,
  Clock,
  Layers,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
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
            <span className="text-sm font-medium text-slate-600">Travel Dashboard</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/search/cities">
              <Button variant="ghost" size="sm" className="text-xs">
                <Search className="mr-1.5 h-3.5 w-3.5" />
                Find Cities
              </Button>
            </Link>
            <Link href="/trips/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                New Trip
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Welcome Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Travel Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage your multi-city journeys, itinerary timelines, and travel budgets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/trips">
              <Button variant="outline" size="sm" className="text-xs">
                View All Trips
              </Button>
            </Link>
            <Link href="/trips/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
                <Plus className="h-4 w-4" />
                Create Trip
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-slate-500">Active Trips</CardTitle>
              <Route className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">2</div>
              <p className="text-xs text-slate-500 mt-1">Multi-city travel plans</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-slate-500">Destinations</CardTitle>
              <MapPin className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">6</div>
              <p className="text-xs text-slate-500 mt-1">Cities planned</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-slate-500">Planned Activities</CardTitle>
              <Layers className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">18</div>
              <p className="text-xs text-slate-500 mt-1">Scheduled across stops</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-slate-500">Total Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">$5,250</div>
              <p className="text-xs text-slate-500 mt-1">Combined travel estimates</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Trips Section */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Itineraries</h2>
            <Link href="/trips" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              Browse All →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Sample Trip 1 */}
            <Card className="overflow-hidden border-slate-200 bg-white transition-all hover:shadow-md">
              <div className="h-36 w-full bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <Badge className="bg-white/20 text-white backdrop-blur-sm border-0 text-[10px]">
                    10 Days • 3 Cities
                  </Badge>
                  <span className="text-xs text-blue-100 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Jun 12 - Jun 22
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Western Europe Discovery</h3>
                  <p className="text-xs text-blue-100 mt-0.5">Paris → Lucerne → Florence</p>
                </div>
              </div>

              <CardContent className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-600 pb-3 border-b border-slate-100">
                  <span>Est. Budget: <strong className="text-slate-900">$2,450</strong></span>
                  <span className="flex items-center gap-1 text-blue-600 font-medium">
                    <Share2 className="h-3.5 w-3.5" /> Shared Link Active
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/trips/sample-1/builder">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Builder
                    </Button>
                  </Link>
                  <Link href="/trips/sample-1/view">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Itinerary View
                    </Button>
                  </Link>
                  <Link href="/trips/sample-1/budget">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Budget
                    </Button>
                  </Link>
                  <Link href="/trips/sample-1/calendar">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Calendar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Sample Trip 2 */}
            <Card className="overflow-hidden border-slate-200 bg-white transition-all hover:shadow-md">
              <div className="h-36 w-full bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <Badge className="bg-white/20 text-white backdrop-blur-sm border-0 text-[10px]">
                    12 Days • 3 Cities
                  </Badge>
                  <span className="text-xs text-teal-100 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Sep 5 - Sep 17
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Japan Autumn Odyssey</h3>
                  <p className="text-xs text-teal-100 mt-0.5">Tokyo → Kyoto → Osaka</p>
                </div>
              </div>

              <CardContent className="p-5">
                <div className="flex items-center justify-between text-xs text-slate-600 pb-3 border-b border-slate-100">
                  <span>Est. Budget: <strong className="text-slate-900">$2,800</strong></span>
                  <span className="text-slate-500">Private Plan</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/trips/sample-2/builder">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Builder
                    </Button>
                  </Link>
                  <Link href="/trips/sample-2/view">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Itinerary View
                    </Button>
                  </Link>
                  <Link href="/trips/sample-2/budget">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Budget
                    </Button>
                  </Link>
                  <Link href="/trips/sample-2/calendar">
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      Calendar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Planning Shortcuts */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Discover & Plan</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              href="/search/cities"
              className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-blue-50/50 hover:border-blue-200"
            >
              <div className="font-semibold text-sm text-slate-900">Explore Cities</div>
              <p className="text-xs text-slate-500 mt-1">Browse curated destinations, daily cost averages, and regional guides.</p>
            </Link>

            <Link
              href="/search/activities"
              className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-blue-50/50 hover:border-blue-200"
            >
              <div className="font-semibold text-sm text-slate-900">Browse Activities</div>
              <p className="text-xs text-slate-500 mt-1">Filter attractions by category, cost, and time duration.</p>
            </Link>

            <Link
              href="/trips/new"
              className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:bg-blue-50/50 hover:border-blue-200"
            >
              <div className="font-semibold text-sm text-slate-900">AI Trip Generator</div>
              <p className="text-xs text-slate-500 mt-1">Draft a multi-city itinerary from a simple natural language prompt.</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

