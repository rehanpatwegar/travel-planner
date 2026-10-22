import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/trips/[id]/members
 * Lists all travel companions and members for a trip.
 * Automatically initializes the trip owner as the primary member if none exist.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      .select("id, user_id, title")
      .eq("id", id)
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

    // Fetch existing trip members
    const { data: existingMembers, error: membersError } = await supabase
      .from("trip_members")
      .select("id, trip_id, user_id, display_name, email, role, created_at, updated_at")
      .eq("trip_id", id)
      .order("created_at", { ascending: true });

    if (membersError) {
      console.error("Error fetching trip members:", membersError.message);
      return NextResponse.json(
        { error: "Failed to fetch trip members" },
        { status: 500 }
      );
    }

    // Self-healing: if the trip has 0 members, auto-initialize the trip owner
    if (!existingMembers || existingMembers.length === 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const ownerName =
        profile?.full_name?.trim() ||
        user.user_metadata?.full_name?.trim() ||
        user.user_metadata?.name?.trim() ||
        "Trip Organizer (You)";

      const { data: autoOwner, error: autoError } = await supabase
        .from("trip_members")
        .insert({
          trip_id: id,
          user_id: user.id,
          display_name: ownerName,
          role: "owner",
        })
        .select("id, trip_id, user_id, display_name, email, role, created_at, updated_at")
        .single();

      if (!autoError && autoOwner) {
        return NextResponse.json({ members: [autoOwner] });
      }

      if (autoError) {
        if (autoError.code === "23505") {
          // Race condition recovery: concurrent request already initialized the owner
          const { data: raceMembers, error: raceError } = await supabase
            .from("trip_members")
            .select("id, trip_id, user_id, display_name, email, role, created_at, updated_at")
            .eq("trip_id", id)
            .order("created_at", { ascending: true });

          if (raceError) {
            console.error(
              "Error re-fetching trip members after race resolution:",
              raceError.message
            );
            return NextResponse.json(
              { error: "Failed to fetch trip members after initialization race." },
              { status: 500 }
            );
          }

          if (raceMembers && raceMembers.length > 0) {
            return NextResponse.json({ members: raceMembers });
          }

          return NextResponse.json(
            { error: "Failed to load trip members after initialization race." },
            { status: 500 }
          );
        }

        // For other insert errors, preserve appropriate error handling rather than treating every error as a duplicate
        console.error("Failed to auto-initialize trip owner:", autoError.message);
        return NextResponse.json(
          { error: "Failed to initialize trip organizer member." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ members: existingMembers || [] });
  } catch (error) {
    console.error("Trip members GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips/[id]/members
 * Adds a new travel companion to the trip.
 * Validates non-empty name and prevents duplicate names on the same trip.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      .eq("id", id)
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

    const body = await request.json().catch(() => ({}));
    const { display_name, email, user_id, role } = body;

    // Validate display_name
    if (!display_name || typeof display_name !== "string" || !display_name.trim()) {
      return NextResponse.json(
        { error: "Member display name is required." },
        { status: 400 }
      );
    }

    const trimmedName = display_name.trim();
    if (trimmedName.length > 100) {
      return NextResponse.json(
        { error: "Display name cannot exceed 100 characters." },
        { status: 400 }
      );
    }

    // Validate optional email
    let validEmail: string | null = null;
    if (email && typeof email === "string" && email.trim()) {
      const emailTrimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        return NextResponse.json(
          { error: "Invalid email format." },
          { status: 400 }
        );
      }
      validEmail = emailTrimmed.toLowerCase();
    }

    // Validate optional user_id
    let validUserId: string | null = null;
    if (user_id && typeof user_id === "string" && user_id.trim()) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user_id.trim())) {
        return NextResponse.json(
          { error: "Invalid user_id format. Must be a valid UUID." },
          { status: 400 }
        );
      }
      validUserId = user_id.trim();
    }

    // Validate role
    const validRole = role === "owner" ? "owner" : "member";

    // Query current members to prevent duplicate names and duplicate linked accounts
    const { data: currentMembers } = await supabase
      .from("trip_members")
      .select("id, display_name, user_id")
      .eq("trip_id", id);

    if (currentMembers && currentMembers.length > 0) {
      const lowerNewName = trimmedName.toLowerCase();
      const duplicateName = currentMembers.some(
        (m) => m.display_name.trim().toLowerCase() === lowerNewName
      );

      if (duplicateName) {
        return NextResponse.json(
          { error: `A travel companion named "${trimmedName}" already exists on this trip.` },
          { status: 409 }
        );
      }

      if (validUserId) {
        const duplicateUser = currentMembers.some((m) => m.user_id === validUserId);
        if (duplicateUser) {
          return NextResponse.json(
            { error: "This user profile is already added to this trip." },
            { status: 409 }
          );
        }
      }
    }

    // Insert new member
    const { data: newMember, error: insertError } = await supabase
      .from("trip_members")
      .insert({
        trip_id: id,
        user_id: validUserId,
        display_name: trimmedName,
        email: validEmail,
        role: validRole,
      })
      .select("id, trip_id, user_id, display_name, email, role, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("Failed to insert trip member:", insertError.message);
      // Handle unique constraint violation code 23505 gracefully
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: `A travel companion named "${trimmedName}" already exists on this trip.` },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to add travel companion." },
        { status: 500 }
      );
    }

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error("Trip members POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

