import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Generate an unguessable, URL-safe slug for public trip sharing.
 * Combines a clean title snippet with 12 random hex characters.
 */
function generateUnguessableSlug(title: string): string {
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const randomSuffix = crypto.randomBytes(6).toString("hex");
  return cleanTitle ? `${cleanTitle}-${randomSuffix}` : `trip-${randomSuffix}`;
}

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

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, title, is_public, share_slug")
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

    const { data: sharedRecord } = await supabase
      .from("shared_trips")
      .select("id, share_slug, is_active, allow_copy, view_count, created_at, expires_at")
      .eq("trip_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const origin =
      request.headers.get("origin") ||
      request.nextUrl.origin ||
      "";

    const activeSlug = trip.is_public
      ? trip.share_slug || sharedRecord?.share_slug || null
      : null;

    return NextResponse.json({
      is_public: !!trip.is_public && !!activeSlug,
      share_slug: activeSlug,
      share_url: activeSlug ? `${origin}/share/${activeSlug}` : null,
      view_count: sharedRecord?.view_count || 0,
      created_at: sharedRecord?.created_at || null,
      expires_at: sharedRecord?.expires_at || null,
      allow_copy: sharedRecord?.allow_copy ?? true,
    });
  } catch (error) {
    console.error("Error fetching share status:", error);
    return NextResponse.json(
      { error: "Failed to fetch share status" },
      { status: 500 }
    );
  }
}

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

    // Verify ownership
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id, title, is_public, share_slug")
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

    // Use existing slug if present, or generate a fresh unguessable slug
    let slug = trip.share_slug;
    if (!slug) {
      slug = generateUnguessableSlug(trip.title);
    }

    // Update trips table
    const { error: updateTripError } = await supabase
      .from("trips")
      .update({
        is_public: true,
        share_slug: slug,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateTripError) {
      console.error("Failed to update trip sharing flag:", updateTripError.message);
      return NextResponse.json(
        { error: "Failed to enable trip sharing" },
        { status: 500 }
      );
    }

    // Upsert shared_trips record to keep both sharing mechanisms in sync
    const { error: sharedError } = await supabase
      .from("shared_trips")
      .upsert(
        {
          trip_id: id,
          share_slug: slug,
          is_active: true,
          allow_copy: true,
        },
        { onConflict: "share_slug" }
      );

    if (sharedError) {
      console.warn("Notice: shared_trips upsert:", sharedError.message);
    }

    const origin =
      request.headers.get("origin") ||
      request.nextUrl.origin ||
      "";

    return NextResponse.json({
      message: "Trip shared successfully",
      is_public: true,
      share_slug: slug,
      share_url: `${origin}/share/${slug}`,
    });
  } catch (error) {
    console.error("Error creating share link:", error);
    return NextResponse.json(
      { error: "Internal server error while creating share link" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify ownership
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

    // Revoke access on trips table
    const { error: tripRevokeError } = await supabase
      .from("trips")
      .update({
        is_public: false,
        share_slug: null,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (tripRevokeError) {
      console.error("Failed to revoke trip sharing:", tripRevokeError.message);
      return NextResponse.json(
        { error: "Failed to revoke share link" },
        { status: 500 }
      );
    }

    // Deactivate in shared_trips
    const { error: sharedRevokeError } = await supabase
      .from("shared_trips")
      .update({ is_active: false })
      .eq("trip_id", id);

    if (sharedRevokeError) {
      console.warn("Notice: shared_trips revoke:", sharedRevokeError.message);
    }

    return NextResponse.json({
      message: "Share link revoked successfully. Trip is now private.",
      is_public: false,
    });
  } catch (error) {
    console.error("Error revoking share link:", error);
    return NextResponse.json(
      { error: "Internal server error while revoking share link" },
      { status: 500 }
    );
  }
}

