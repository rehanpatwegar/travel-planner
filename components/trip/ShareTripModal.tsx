"use client";

import { useEffect, useState } from "react";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ShareTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  tripTitle: string;
  initialIsPublic?: boolean;
  initialShareSlug?: string | null;
  onShareStatusChange?: (isPublic: boolean, shareSlug: string | null) => void;
}

export function ShareTripModal({
  isOpen,
  onClose,
  tripId,
  tripTitle,
  initialIsPublic = false,
  initialShareSlug = null,
  onShareStatusChange,
}: ShareTripModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [shareSlug, setShareSlug] = useState<string | null>(initialShareSlug);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [viewCount, setViewCount] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmRevoke(false);
      setErrorMsg(null);
      setSuccessMsg(null);
      return;
    }

    async function fetchShareStatus() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/trips/${tripId}/share`);
        if (res.ok) {
          const data = await res.json();
          setIsPublic(data.is_public);
          setShareSlug(data.share_slug);
          setShareUrl(data.share_url || (data.share_slug ? `${window.location.origin}/share/${data.share_slug}` : ""));
          setViewCount(data.view_count || 0);
        }
      } catch (err) {
        console.error("Failed to load share status", err);
      } finally {
        setLoading(false);
      }
    }

    fetchShareStatus();
  }, [isOpen, tripId]);

  if (!isOpen) return null;

  async function handleCreateShare() {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create share link");
      }

      setIsPublic(true);
      setShareSlug(data.share_slug);
      const fullUrl = data.share_url || `${window.location.origin}/share/${data.share_slug}`;
      setShareUrl(fullUrl);
      setSuccessMsg("Public share link activated successfully.");
      onShareStatusChange?.(true, data.share_slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create share link";
      setErrorMsg(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeShare() {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke share link");
      }

      setIsPublic(false);
      setShareSlug(null);
      setShareUrl("");
      setConfirmRevoke(false);
      setSuccessMsg("Share link revoked. Your trip is now completely private.");
      onShareStatusChange?.(false, null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke share link";
      setErrorMsg(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Share Itinerary</h3>
              <p className="text-xs text-slate-500 line-clamp-1">{tripTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Body Content */}
        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="mt-2 text-xs font-medium">Checking share status...</p>
            </div>
          ) : isPublic && shareUrl ? (
            <div className="space-y-4">
              {/* Active Sharing Status */}
              <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 border border-emerald-100 p-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white border-0 text-[11px]">
                    Public Link Active
                  </Badge>
                  <span className="text-xs text-emerald-800">Anyone with the link can view</span>
                </div>
                {viewCount > 0 && (
                  <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                    <Eye className="h-3 w-3" />
                    {viewCount} {viewCount === 1 ? "view" : "views"}
                  </span>
                )}
              </div>

              {/* Share URL Input & Copy */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Public Link</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="h-9 text-xs bg-slate-50 text-slate-700 font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={handleCopy}
                    className="h-9 shrink-0 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-200" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Security & Privacy Notice */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 leading-relaxed">
                <strong className="text-slate-800 font-medium">Privacy Protected:</strong> Visitors see a read-only day-by-day itinerary. Your private budget expenses, personal notes, and account identity are strictly protected and never shared.
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Preview Public View
                </a>

                {confirmRevoke ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-600 font-medium">Revoke link?</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmRevoke(false)}
                      className="text-xs h-7 px-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleRevokeShare}
                      disabled={actionLoading}
                      className="text-xs h-7 px-2.5 bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Revoke"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRevoke(true)}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                    Revoke Access
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Private State */
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
                  <Share2 className="h-5 w-5" />
                </div>
                <h4 className="font-semibold text-slate-900 text-sm">Trip is currently private</h4>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Generate an unguessable read-only link to share your stops and scheduled activities. You can revoke access at any time.
                </p>
              </div>

              <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-3 text-[11px] text-blue-800 leading-relaxed">
                Only the itinerary schedule and estimated activity costs are visible. Private expenses and account details remain secure.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-9">
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateShare}
                  disabled={actionLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating Link...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5" />
                      Create Share Link
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

