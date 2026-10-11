import Link from "next/link";
import { Compass, Plus, MapPin, Calendar, DollarSign, Route, ArrowRight, Share2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function TripsPage() {
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
            <span className="text-sm font-medium text-slate-600">My Trips</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-xs">
                Dashboard
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

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              All Saved Trips
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              View, edit, and organize all your upcoming and past travel itineraries.
            </p>
          </div>

          <Link href="/trips/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              <Plus className="h-4 w-4" />
              Create New Trip
            </Button>
          </Link>
        </div>

        {/* Trips List */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Trip 1 */}
          <Card className="overflow-hidden border-slate-200 bg-white transition-all hover:shadow-md">
            <div className="h-32 w-full bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex flex-col justify-between">
              <Badge className="bg-white/20 text-white border-0 text-[10px] w-fit">
                3 Stops • 10 Days
              </Badge>
              <div>
                <h3 className="font-bold text-lg leading-tight">Western Europe Discovery</h3>
                <p className="text-xs text-blue-100 mt-0.5">Paris → Lucerne → Florence</p>
              </div>
            </div>

            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Jun 12 - Jun 22, 2026
                </span>
                <span className="font-semibold text-emerald-600">$2,450 Budget</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Link href="/trips/sample-1/builder">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    Itinerary Builder
                  </Button>
                </Link>
                <Link href="/trips/sample-1/view">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    View Plan
                  </Button>
                </Link>
                <Link href="/trips/sample-1/budget">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    Budget
                  </Button>
                </Link>
                <Link href="/trips/sample-1/calendar">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    Calendar
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Trip 2 */}
          <Card className="overflow-hidden border-slate-200 bg-white transition-all hover:shadow-md">
            <div className="h-32 w-full bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white flex flex-col justify-between">
              <Badge className="bg-white/20 text-white border-0 text-[10px] w-fit">
                3 Stops • 12 Days
              </Badge>
              <div>
                <h3 className="font-bold text-lg leading-tight">Japan Autumn Odyssey</h3>
                <p className="text-xs text-teal-100 mt-0.5">Tokyo → Kyoto → Osaka</p>
              </div>
            </div>

            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Sep 5 - Sep 17, 2026
                </span>
                <span className="font-semibold text-emerald-600">$2,800 Budget</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Link href="/trips/sample-2/builder">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    Itinerary Builder
                  </Button>
                </Link>
                <Link href="/trips/sample-2/view">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    View Plan
                  </Button>
                </Link>
                <Link href="/trips/sample-2/budget">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    Budget
                  </Button>
                </Link>
                <Link href="/trips/sample-2/calendar">
                  <Button variant="outline" size="sm" className="w-full text-xs h-8">
                    Calendar
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

