import Link from "next/link";
import {
  Compass,
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TripCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href={`/trips/${id}/builder`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-3.5 w-3.5" />
              Builder
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-sm text-slate-900">Calendar Timeline</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/trips/${id}/view`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Itinerary View
              </Button>
            </Link>
            <Link href={`/trips/${id}/budget`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Budget
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Calendar View */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Trip Calendar
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              June 2026 • Western Europe Discovery (10 Days)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8">
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8">
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Calendar Timeline Grid */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Day 1 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-xs font-bold text-blue-600">Day 1 • Jun 12</div>
              <div className="text-xs font-semibold text-slate-900 mt-1">Paris Arrival</div>
              <div className="mt-3 space-y-2">
                <div className="rounded bg-white p-2 text-xs border border-slate-100 shadow-2xs">
                  <div className="font-medium text-slate-900">Louvre Museum</div>
                  <div className="text-[10px] text-slate-400">10:00 AM</div>
                </div>
                <div className="rounded bg-white p-2 text-xs border border-slate-100 shadow-2xs">
                  <div className="font-medium text-slate-900">Seine Cruise</div>
                  <div className="text-[10px] text-slate-400">06:00 PM</div>
                </div>
              </div>
            </div>

            {/* Day 2 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-xs font-bold text-blue-600">Day 2 • Jun 13</div>
              <div className="text-xs font-semibold text-slate-900 mt-1">Paris Sights</div>
              <div className="mt-3 space-y-2">
                <div className="rounded bg-white p-2 text-xs border border-slate-100 shadow-2xs">
                  <div className="font-medium text-slate-900">Marais Food Walk</div>
                  <div className="text-[10px] text-slate-400">02:00 PM</div>
                </div>
              </div>
            </div>

            {/* Day 3 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-xs font-bold text-blue-600">Day 3 • Jun 14</div>
              <div className="text-xs font-semibold text-slate-900 mt-1">Paris Architecture</div>
              <div className="mt-3 space-y-2">
                <div className="rounded bg-white p-2 text-xs border border-slate-100 shadow-2xs">
                  <div className="font-medium text-slate-900">Eiffel Tower Summit</div>
                  <div className="text-[10px] text-slate-400">04:00 PM</div>
                </div>
              </div>
            </div>

            {/* Day 4 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-xs font-bold text-indigo-600">Day 4 • Jun 15</div>
              <div className="text-xs font-semibold text-slate-900 mt-1">Transit to Lucerne</div>
              <div className="mt-3 space-y-2">
                <div className="rounded bg-indigo-50 p-2 text-xs border border-indigo-100 text-indigo-900">
                  <div className="font-medium">TGV Lyria Express</div>
                  <div className="text-[10px] text-indigo-600">09:15 AM - 01:30 PM</div>
                </div>
              </div>
            </div>

            {/* Day 5 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-xs font-bold text-emerald-600">Day 5 • Jun 16</div>
              <div className="text-xs font-semibold text-slate-900 mt-1">Lucerne Alpine</div>
              <div className="mt-3 space-y-2">
                <div className="rounded bg-white p-2 text-xs border border-slate-100 shadow-2xs">
                  <div className="font-medium text-slate-900">Mount Pilatus Climb</div>
                  <div className="text-[10px] text-slate-400">09:00 AM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

