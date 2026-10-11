import Link from "next/link";
import {
  Compass,
  ArrowLeft,
  DollarSign,
  PieChart,
  Plus,
  TrendingDown,
  Layers,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function TripBudgetPage({
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
            <span className="font-bold text-sm text-slate-900">Trip Budget & Expenses</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/trips/${id}/view`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                Itinerary View
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

      {/* Main Budget Dashboard */}
      <main className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Trip Budget Analysis
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Western Europe Discovery • 10 Days • Target Budget: $2,450
            </p>
          </div>

          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </Button>
        </div>

        {/* Financial Stat Cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-slate-500">Total Allocated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">$2,450.00</div>
              <p className="text-xs text-slate-500 mt-1">Planned overall budget</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-slate-500">Estimated Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">$1,840.00</div>
              <p className="text-xs text-slate-500 mt-1">75% of budget committed</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-slate-500">Remaining Buffer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">$610.00</div>
              <p className="text-xs text-slate-500 mt-1">Available for unbudgeted meals & tips</p>
            </CardContent>
          </Card>
        </div>

        {/* Category Allocation */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Category Progress Bars */}
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">Expense Breakdown by Category</CardTitle>
              <CardDescription className="text-xs">
                Categorized according to schema rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-700 font-medium mb-1">
                  <span>Accommodation</span>
                  <span>$1,050 / $1,200</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: "87%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 font-medium mb-1">
                  <span>Activities & Sightseeing</span>
                  <span>$340 / $500</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: "68%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 font-medium mb-1">
                  <span>Transportation & Rail</span>
                  <span>$280 / $400</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: "70%" }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 font-medium mb-1">
                  <span>Food & Dining</span>
                  <span>$170 / $350</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "48%" }}></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Cost Per Day */}
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">Cost-Per-Day Analysis</CardTitle>
              <CardDescription className="text-xs">
                Average daily pacing across 10 days of travel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-center">
                <span className="text-xs font-semibold uppercase text-slate-400 block">Average Estimated Daily Burn</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-1 block">$184 <span className="text-xs text-slate-500 font-normal">/ day</span></span>
                <p className="mt-2 text-xs text-slate-500">
                  Matches Western Europe typical traveler expenditure ($180–$220/day).
                </p>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Paris (Days 1–4)</span>
                  <span className="font-semibold text-slate-900">~$190/day</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Lucerne (Days 5–7)</span>
                  <span className="font-semibold text-slate-900">~$210/day</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Florence (Days 8–10)</span>
                  <span className="font-semibold text-slate-900">~$160/day</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

