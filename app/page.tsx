import Link from "next/link";
import {
  Calendar,
  DollarSign,
  Sparkles,
  Share2,
  Compass,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Bot,
  Route,
  ChevronRight,
  SlidersHorizontal,
  MapPin,
  PieChart,
  CalendarDays,
  Shield,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <Compass className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              GlobeTrotter
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <a
              href="#itineraries"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Multi-City Itineraries
            </a>
            <a
              href="#budget-calendar"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Budget & Calendar
            </a>
            <a
              href="#ai-assistance"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              AI Assistant
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              How It Works
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-700 hover:text-slate-900">
                Sign In
              </Button>
            </Link>
            <Link href="/trips/new">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                Start Planning
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-14 pb-20 md:pt-24 md:pb-28 bg-gradient-to-b from-white via-slate-50/80 to-slate-100">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-sm mb-6">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Modern Multi-City Travel Planning</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Your next adventure,{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
                thoughtfully planned.
              </span>
            </h1>

            <p className="mt-6 text-lg text-slate-600 sm:text-xl sm:leading-relaxed">
              Plan multi-city trips, organize your itinerary, manage your budget, and
              discover smarter ways to travel with AI-powered assistance.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/trips/new" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 sm:w-auto font-medium">
                  Start Planning
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#features" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-50 font-medium">
                  <Compass className="mr-2 h-4 w-4 text-slate-500" />
                  Explore Features
                </Button>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" /> Multi-City Coordination
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" /> Drag-and-Drop Itinerary
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" /> Real-Time Expense Tracking
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" /> Read-Only Link Sharing
              </span>
            </div>
          </div>

          {/* SaaS Interface Preview Card */}
          <div className="mt-14 mx-auto max-w-5xl rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl sm:p-7">
            {/* Trip Header Banner */}
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-medium text-xs">
                    Multi-City Trip Plan
                  </Badge>
                  <span className="text-xs text-slate-500">12 Days • 3 Destinations</span>
                </div>
                <h3 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Grand Alpine Explorer: Zurich → Lucerne → Munich
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  Budget: $2,800
                </div>
                <div className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5" />
                  Shared Link Active
                </div>
              </div>
            </div>

            {/* Main Interactive Grid Mockup */}
            <div className="grid grid-cols-1 gap-6 pt-6 lg:grid-cols-12">
              {/* Left Column: Itinerary Days */}
              <div className="space-y-4 lg:col-span-8">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Day-by-Day Schedule
                  </span>
                  <span className="text-xs text-blue-600 font-medium cursor-default">
                    Drag & Drop Enabled
                  </span>
                </div>

                {/* Day 1 Item */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                        Day 1
                      </span>
                      <span className="font-semibold text-sm text-slate-900">Zurich, Switzerland</span>
                    </div>
                    <span className="text-xs text-slate-500">Old Town & Lake Views</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">Altstadt Walking Tour</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-slate-100">Sightseeing</Badge>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">Lake Zurich Sunset Cruise</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">Relaxation</Badge>
                    </div>
                  </div>
                </div>

                {/* Day 2 Item */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                        Day 5
                      </span>
                      <span className="font-semibold text-sm text-slate-900">Lucerne, Switzerland</span>
                    </div>
                    <span className="text-xs text-slate-500">Mountain Excursion</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-800">Mount Pilatus Cable Car Climb</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">Adventure</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Budget Breakdown & AI Recommendations */}
              <div className="space-y-4 lg:col-span-4">
                {/* Budget Widget */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">Expense Allocation</span>
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Accommodation</span>
                      <span className="font-semibold text-slate-900">$1,200</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: "45%" }}></div>
                    </div>

                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>Activities & Tours</span>
                      <span className="font-semibold text-slate-900">$750</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: "30%" }}></div>
                    </div>

                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>Dining & Transit</span>
                      <span className="font-semibold text-slate-900">$850</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "25%" }}></div>
                    </div>
                  </div>
                </div>

                {/* AI Assistant Insight Box */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
                    <Lightbulb className="h-4 w-4 text-indigo-600" />
                    <span>Itinerary Optimization</span>
                  </div>
                  <p className="mt-2 text-xs text-indigo-800 leading-relaxed">
                    Transit tip: Taking the 09:15 train between Lucerne and Zurich leaves your afternoon completely clear for the lake cruise.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50/50">
              Core Capabilities
            </Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Engineered for Seamless Travel Organization
            </h2>
            <p className="mt-4 text-base text-slate-600">
              Everything required to structure multi-city journeys, from early drafts to execution.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1: Multi-City Itineraries */}
            <Card id="itineraries" className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 mb-2">
                  <Route className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Multi-City Itineraries</CardTitle>
                <CardDescription>
                  Connect multiple destinations into one fluid travel sequence. Set dates and
                  durations for each city with clear transition days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  Easily adjust stop sequences as your plans evolve.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2: Day-by-Day Scheduling */}
            <Card className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 mb-2">
                  <Layers className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Day-by-Day Scheduling</CardTitle>
                <CardDescription>
                  Organize daily activities by time slots. Arrange morning, afternoon, and
                  evening plans with intuitive drag-and-drop reordering.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  Fine-tune daily schedules without losing track of your overall pacing.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3: Budget Planning */}
            <Card id="budget-calendar" className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 mb-2">
                  <PieChart className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Budget Planning & Tracking</CardTitle>
                <CardDescription>
                  Keep financial clarity across your trip. Monitor total expenditure, categorize
                  costs, and inspect day-by-day expense breakdowns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  Breakdowns for stays, activities, transit, and meals.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4: Calendar Organization */}
            <Card className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 mb-2">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Calendar Organization</CardTitle>
                <CardDescription>
                  View your complete travel schedule on an interactive calendar. Spot open hours
                  and avoid conflicting activity times effortlessly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  Switch between agenda, weekly, and monthly schedule overviews.
                </p>
              </CardContent>
            </Card>

            {/* Feature 5: AI Assistance */}
            <Card id="ai-assistance" className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 mb-2">
                  <Bot className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">AI-Powered Travel Assistance</CardTitle>
                <CardDescription>
                  Generate complete trip drafts from natural descriptions, optimize itinerary
                  routes, and ask contextual questions about your saved travel plans.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  Intelligent suggestions designed for you to edit and customize.
                </p>
              </CardContent>
            </Card>

            {/* Feature 6: Itinerary Sharing */}
            <Card className="border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600 mb-2">
                  <Share2 className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Trip Sharing</CardTitle>
                <CardDescription>
                  Create read-only public links to share your multi-city itinerary with family
                  or travel companions while your editing rights remain protected.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  Clean, readable itinerary view accessible on any device.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Intelligence Deep-Dive Section */}
      <section className="py-20 bg-slate-50 border-t border-slate-200/80">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                <Sparkles className="h-3.5 w-3.5" />
                Intelligent Planning Support
              </div>

              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                AI Assistance Designed for Travelers, Not Algorithms
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                GlobeTrotter pairs generative travel suggestions with full personal control.
                AI creates structured starting points that you can refine, reorder, or completely reshape.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white text-xs font-bold">
                    1
                  </div>
                  AI Trip Generator
                </div>
                <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                  Turn natural-language prompts like &ldquo;10 days in Northern Italy focusing on food and historic architecture&rdquo; into an actionable multi-city itinerary.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white text-xs font-bold">
                    2
                  </div>
                  Itinerary Optimizer
                </div>
                <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                  Analyze your existing schedule to smooth out crowded days, refine stop order, and identify potential budget efficiencies.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-600 text-white text-xs font-bold">
                    3
                  </div>
                  Context-Aware Assistant
                </div>
                <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                  Ask travel questions grounded directly in your saved itinerary data, from transit buffer advice to packing tips.
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Shield className="h-4 w-4 text-blue-600" />
              <span>
                All AI suggestions are validated structured plans. You maintain complete control over what is saved.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="border-slate-300 text-slate-700">
              Workflow
            </Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              From Concept to Completed Itinerary
            </h2>
            <p className="mt-4 text-base text-slate-600">
              A clear, four-step progression designed to make multi-city trips manageable.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white shadow-sm">
                1
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">Define Trip Parameters</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Specify destinations, target travel dates, estimated budget, and pacing preferences.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white shadow-sm">
                2
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">Build or Generate</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Start with an intelligent AI draft or search cities and add curated activities manually.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white shadow-sm">
                3
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">Arrange & Balance</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Reorder stops and activities with drag-and-drop while reviewing expenses in real-time.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white shadow-sm">
                4
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">Review & Share</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Verify schedule flow on the calendar and share a read-only link with co-travelers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Start Planning Your Next Journey
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-blue-100">
            Keep your routes, daily schedules, and travel budget organized in one centralized workspace.
          </p>

          <div className="mt-8 flex justify-center">
            <Link href="/trips/new">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-slate-100 shadow-md font-medium">
                Start Planning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Compass className="h-4 w-4" />
              </div>
              <span className="font-bold text-slate-900 text-lg">GlobeTrotter</span>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-600">
              <a href="#itineraries" className="hover:text-blue-600 transition-colors">
                Itineraries
              </a>
              <a href="#budget-calendar" className="hover:text-blue-600 transition-colors">
                Budget & Calendar
              </a>
              <a href="#ai-assistance" className="hover:text-blue-600 transition-colors">
                AI Assistant
              </a>
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors">
                How It Works
              </a>
            </div>

            <div className="text-xs text-slate-500 text-center sm:text-right">
              © 2026 GlobeTrotter. Thoughtful multi-city travel planning.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
