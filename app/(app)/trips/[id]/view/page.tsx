import Link from "next/link";
import {
  Compass,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Share2,
  DollarSign,
  Printer,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default async function TripViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href={`/trips/${id}/builder`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-3.5 w-3.5" />
              Builder
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-sm text-slate-900">Itinerary View</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/share/western-europe-sample`}>
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5">
                <Share2 className="h-3.5 w-3.5 text-blue-600" />
                Public Link
              </Button>
            </Link>
            <Link href={`/trips/${id}/builder`}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
                Edit Plan
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Itinerary Content */}
      <main className="container mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Trip Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                10 Days • 3 Destinations
              </Badge>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-slate-900">
                Western Europe Discovery
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Route: Paris (4d) → Lucerne (3d) → Florence (3d) • Est. Budget: $2,450
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border border-emerald-200">
                Active Itinerary
              </Badge>
            </div>
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
              <span className="text-xs text-slate-500">Jun 12, 2026</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-slate-50/70 p-3">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">Louvre Museum Guided Tour</h4>
                    <span className="text-xs font-bold text-emerald-600">$22</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Explore iconic masterpieces including the Mona Lisa and Venus de Milo.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-slate-50/70 p-3">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">Seine River Sunset Cruise</h4>
                    <span className="text-xs font-bold text-emerald-600">$18</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Glide past Notre-Dame and historic Parisian bridges at twilight.</p>
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
              <span className="text-xs text-slate-500">Jun 13, 2026</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-slate-50/70 p-3">
                <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">Le Marais Pastry & Food Walk</h4>
                    <span className="text-xs font-bold text-emerald-600">$55</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Taste artisanal croissants, macarons, and regional cheeses in the historic Marais.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

