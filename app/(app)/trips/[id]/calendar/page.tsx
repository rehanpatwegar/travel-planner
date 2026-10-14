import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TripCalendarClient } from "@/components/trip/TripCalendarClient";

export default async function TripCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?redirect=/trips/${id}/calendar`);
  }

  // Fetch the trip
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .single();

  if (tripError || !trip) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Trip Not Found</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            The requested trip could not be found or you may not have permission to view it.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/trips">
              <Button size="sm" variant="outline" className="text-xs">
                Back to Trips
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Verify authorization
  if (trip.user_id !== user.id && !trip.is_public) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            You do not have permission to view the calendar for this private trip.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/trips">
              <Button size="sm" variant="outline" className="text-xs">
                My Trips
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch stops
  const { data: stops } = await supabase
    .from("trip_stops")
    .select("*, cities(*)")
    .eq("trip_id", id)
    .order("order_index", { ascending: true });

  // Fetch itinerary items
  const { data: items } = await supabase
    .from("itinerary_items")
    .select("*, activities(*)")
    .eq("trip_id", id)
    .order("day_number", { ascending: true })
    .order("order_index", { ascending: true });

  return (
    <TripCalendarClient
      trip={trip}
      items={items || []}
      stops={stops || []}
    />
  );
}
