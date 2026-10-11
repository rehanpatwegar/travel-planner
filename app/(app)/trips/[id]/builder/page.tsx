import Link from "next/link";
import {
  Compass,
  ArrowLeft,
  Plus,
  Clock,
  MapPin,
  Calendar,
  GripVertical,
  Layers,
  Sparkles,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TripBuilderPage({
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
            <Link href="/trips" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-3.5 w-3.5" />
              Trips
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-sm text-slate-900">Itinerary Builder</span>
            <Badge variant="outline" className="text-[10px] border-blue-200 bg-blue-50 text-blue-700">
              Trip ID: {id}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/trips/${id}/view`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Preview Itinerary
              </Button>
            </Link>
            <Link href={`/trips/${id}/budget`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Budget
              </Button>
            </Link>
            <Link href={`/trips/${id}/calendar`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Calendar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Builder Workspace */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Western Europe Discovery
            </h1>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-3">
              <span>10 Days (Jun 12 - Jun 22)</span>
              <span>•</span>
              <span>Stops: Paris → Lucerne → Florence</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              AI Optimize Day Pacing
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Activity
            </Button>
          </div>
        </div>

        {/* Day-by-Day Columns */}
        <div className="mt-8 space-y-6">
          {/* Day 1 */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/70 py-3 px-5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                  Day 1
                </span>
                <span className="font-semibold text-sm text-slate-900">Paris, France</span>
                <span className="text-xs text-slate-400">• Arrival & Historic Center</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7 gap-1">
                <Plus className="h-3 w-3" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">10:00 AM - 01:00 PM</span>
                      <Badge variant="secondary" className="text-[10px]">Culture & History</Badge>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 mt-1">Louvre Museum Guided Tour</h4>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600">$22 est.</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">06:00 PM - 07:30 PM</span>
                      <Badge variant="secondary" className="text-[10px]">Relaxation</Badge>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 mt-1">Seine River Sunset Cruise</h4>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600">$18 est.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Day 2 */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/70 py-3 px-5">
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                  Day 2
                </span>
                <span className="font-semibold text-sm text-slate-900">Paris, France</span>
                <span className="text-xs text-slate-400">• Montmartre & Panoramic Vistas</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-7 gap-1">
                <Plus className="h-3 w-3" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">02:00 PM - 04:30 PM</span>
                      <Badge variant="secondary" className="text-[10px]">Food & Dining</Badge>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 mt-1">Le Marais Pastry & Food Walk</h4>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600">$55 est.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

