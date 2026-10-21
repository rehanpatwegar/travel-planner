"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareTripModal } from "@/components/trip/ShareTripModal";

interface TripViewHeaderActionsProps {
  tripId: string;
  tripTitle: string;
  isPublic?: boolean;
  shareSlug?: string | null;
  isOwner?: boolean;
}

export function TripViewHeaderActions({
  tripId,
  tripTitle,
  isPublic = false,
  shareSlug = null,
  isOwner = true,
}: TripViewHeaderActionsProps) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete trip");
      }
      router.push("/trips");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete trip";
      setDeleteError(msg);
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShareOpen(true)}
          className="text-xs h-8 gap-1.5 text-slate-700 hover:text-blue-600"
        >
          <Share2 className="h-3.5 w-3.5 text-blue-600" />
          <span className="hidden sm:inline">Share</span>
        </Button>

        {isOwner && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 sm:px-2.5"
            title="Delete Trip"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <ShareTripModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        tripId={tripId}
        tripTitle={tripTitle}
        initialIsPublic={isPublic}
        initialShareSlug={shareSlug}
      />

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Trip</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                {deleteError}
              </div>
            )}

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 font-semibold">&ldquo;{tripTitle}&rdquo;</strong>?
              All associated itinerary activities, multi-city stops, expenses, and sharing links will be permanently removed.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 gap-1.5"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Trip
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

