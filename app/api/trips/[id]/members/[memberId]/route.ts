import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/trips/[id]/members/[memberId]
 * Safely removes a travel companion from a trip.
 *
 * Integrity Guards:
 * 1. Blocks deletion of the trip owner (`role === 'owner'`).
 * 2. Blocks deletion if the member is listed as payer on any trip expenses.
 * 3. Blocks deletion if the member has active split shares in any expenses.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: tripId, memberId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify trip ownership
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id")
      .eq("id", tripId)
      .maybeSingle();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You do not own this trip" },
        { status: 403 }
      );
    }

    // Fetch the target member and verify trip association
    const { data: targetMember, error: memberError } = await supabase
      .from("trip_members")
      .select("id, trip_id, display_name, role")
      .eq("id", memberId)
      .eq("trip_id", tripId)
      .maybeSingle();

    if (memberError || !targetMember) {
      return NextResponse.json(
        { error: "Member not found on this trip." },
        { status: 404 }
      );
    }

    // Guard 1: Prevent deleting the trip owner
    if (targetMember.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the trip organizer/owner from the trip." },
        { status: 400 }
      );
    }

    // Guard 2: Prevent deletion if listed as payer on any expenses
    const { count: payerExpenseCount, error: payerCountError } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .eq("paid_by_member_id", memberId);

    if (payerCountError) {
      console.error("Error checking member expenses:", payerCountError.message);
      return NextResponse.json(
        { error: "Failed to verify member expense records." },
        { status: 500 }
      );
    }

    if (payerExpenseCount && payerExpenseCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot remove "${targetMember.display_name}": They are recorded as the payer for ${payerExpenseCount} expense(s). Please reassign or delete those expenses first.`,
        },
        { status: 400 }
      );
    }

    // Guard 3: Prevent deletion if having active split shares
    const { count: activeSplitCount, error: splitCountError } = await supabase
      .from("expense_splits")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId);

    if (splitCountError) {
      console.error("Error checking member splits:", splitCountError.message);
      return NextResponse.json(
        { error: "Failed to verify member split records." },
        { status: 500 }
      );
    }

    if (activeSplitCount && activeSplitCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot remove "${targetMember.display_name}": They have active cost split shares in ${activeSplitCount} expense(s). Please adjust or delete those expense splits first.`,
        },
        { status: 400 }
      );
    }

    // Perform deletion
    const { error: deleteError } = await supabase
      .from("trip_members")
      .delete()
      .eq("id", memberId)
      .eq("trip_id", tripId);

    if (deleteError) {
      console.error("Failed to delete trip member:", deleteError.message);
      return NextResponse.json(
        { error: "Failed to delete travel companion." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedId: memberId,
      displayName: targetMember.display_name,
    });
  } catch (error) {
    console.error("Trip member DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

