import Link from "next/link";
import { Compass, ArrowLeft, Sparkles, MapPin, Calendar, DollarSign, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function NewTripPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Compass className="h-4 w-4" />
              </div>
              <span className="font-bold tracking-tight text-slate-900">GlobeTrotter</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-600">Create New Trip</span>
          </div>

          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Form */}
      <main className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
              Trip Setup
            </Badge>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              Plan a New Journey
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Set your travel destinations, dates, and budget parameters to start building your itinerary.
            </p>
          </div>

          {/* AI Generator Box */}
          <div className="mt-8 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-blue-50/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-900 font-semibold text-sm">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>AI Trip Generator</span>
            </div>
            <p className="mt-1.5 text-xs text-indigo-800 leading-relaxed">
              Describe your dream trip in plain English (e.g. &ldquo;10 days in Switzerland and Italy for two focusing on mountains, scenic trains, and local food&rdquo;) to generate an intelligent initial draft.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Where do you want to travel, for how long, and what are your interests?"
                className="bg-white text-xs h-9"
              />
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs whitespace-nowrap">
                Generate Draft
              </Button>
            </div>
          </div>

          {/* Manual Trip Creation Card */}
          <Card className="mt-6 border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Trip Details</CardTitle>
              <CardDescription className="text-xs">
                Configure your trip parameters manually. You can customize stops and add activities next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Trip Title</label>
                <Input placeholder="e.g. European Summer Explorer" className="h-10 text-sm" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Start Date</label>
                  <Input type="date" className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">End Date</label>
                  <Input type="date" className="h-10 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Estimated Total Budget</label>
                  <Input type="number" placeholder="2500" className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Currency</label>
                  <Input defaultValue="USD" className="h-10 text-sm" />
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-slate-700">Destinations (City Stops)</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700 text-xs font-bold">1</span>
                    <Input placeholder="Stop 1: e.g. Paris, France" className="h-9 text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700 text-xs font-bold">2</span>
                    <Input placeholder="Stop 2: e.g. Lucerne, Switzerland" className="h-9 text-xs" />
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="mt-2 text-xs text-blue-600 gap-1 h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Add Another Stop
                </Button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="text-xs">
                    Cancel
                  </Button>
                </Link>
                <Link href="/trips/sample-1/builder">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                    Create & Start Building
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

