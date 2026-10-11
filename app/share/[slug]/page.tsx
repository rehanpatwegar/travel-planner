import Link from "next/link";
import {
  Compass,
  Calendar,
  Clock,
  MapPin,
  Share2,
  Copy,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Compass className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs gap-1">
              <ShieldCheck className="h-3 w-3" />
              Read-Only View
            </Badge>
            <Link href="/trips/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-sm">
                Plan Your Own Trip
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                  Shared Multi-City Itinerary
                </Badge>
                <span className="text-xs text-slate-400 font-mono">slug: {slug}</span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-slate-900">
                Western Europe Discovery
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                10 Days • Paris (France) → Lucerne (Switzerland) → Florence (Italy)
              </p>
            </div>

            <Link href="/trips/new">
              <Button size="sm" variant="outline" className="text-xs gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copy as Template
              </Button>
            </Link>
          </div>
        </div>

        {/* Day-by-Day Timeline */}
        <div className="mt-8 space-y-6">
          {/* Day 1 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">Day 1</span>
                <h3 className="font-bold text-base text-slate-900">Paris, France</h3>
              </div>
              <span className="text-xs text-slate-500">Arrival & Louvre Tour</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-slate-50/70 p-3">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">Louvre Museum Guided Tour</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Explore iconic masterpieces including the Mona Lisa and Venus de Milo.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-slate-50/70 p-3">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">Seine River Sunset Cruise</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Panoramic evening cruise past illuminated bridges and Notre-Dame Cathedral.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Day 2 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">Day 2</span>
                <h3 className="font-bold text-base text-slate-900">Paris, France</h3>
              </div>
              <span className="text-xs text-slate-500">Historic Marais Walk</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-slate-50/70 p-3">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">Le Marais Pastry & Food Walk</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Taste artisanal croissants, macarons, and regional cheeses in the historic Marais.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-12 rounded-xl bg-blue-600 p-8 text-center text-white shadow-md">
          <h2 className="text-xl font-bold sm:text-2xl">Plan your own personalized itinerary</h2>
          <p className="mt-2 text-xs text-blue-100 max-w-md mx-auto">
            Build multi-city trips with intelligent day-by-day scheduling, budget tracking, and easy sharing on GlobeTrotter.
          </p>
          <div className="mt-5">
            <Link href="/trips/new">
              <Button size="sm" className="bg-white text-blue-600 hover:bg-slate-100 font-semibold">
                Start Planning Free
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

