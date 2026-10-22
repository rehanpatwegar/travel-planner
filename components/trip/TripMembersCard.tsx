"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Crown,
  User,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Mail,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TripMember } from "./types";

interface TripMembersCardProps {
  tripId: string;
  members: TripMember[];
  loading?: boolean;
  onMembersChange: (updatedMembers: TripMember[]) => void;
  onExpenseRefreshNeeded?: () => void;
}

export function TripMembersCard({
  tripId,
  members,
  loading = false,
  onMembersChange,
  onExpenseRefreshNeeded,
}: TripMembersCardProps) {
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setAddError("Please enter a member name.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: trimmedName,
          email: email.trim() || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to add travel companion.");
      }

      if (data.member) {
        onMembersChange([...members, data.member]);
      } else {
        // Fallback: re-fetch all members from API
        const refreshRes = await fetch(`/api/trips/${tripId}/members`);
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          if (freshData.members) {
            onMembersChange(freshData.members);
          }
        }
      }

      // Reset form
      setDisplayName("");
      setEmail("");
      setIsAddingOpen(false);
    } catch (err: unknown) {
      setAddError(
        err instanceof Error ? err.message : "Error adding travel companion."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMember(member: TripMember) {
    setDeleteError(null);

    if (member.role === "owner") {
      setDeleteError("Cannot remove the trip organizer from the trip.");
      return;
    }

    const confirmMsg = `Are you sure you want to remove "${member.display_name}" from this trip?`;
    if (!confirm(confirmMsg)) return;

    setDeletingMemberId(member.id);

    try {
      const res = await fetch(`/api/trips/${tripId}/members/${member.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // API error gives actionable explanation if member is linked to expenses or splits
        throw new Error(data.error || "Failed to remove companion.");
      }

      // Re-fetch persisted members list
      const refreshRes = await fetch(`/api/trips/${tripId}/members`);
      if (refreshRes.ok) {
        const freshData = await refreshRes.json();
        if (freshData.members) {
          onMembersChange(freshData.members);
        }
      } else {
        onMembersChange(members.filter((m) => m.id !== member.id));
      }

      if (onExpenseRefreshNeeded) {
        onExpenseRefreshNeeded();
      }
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Could not remove member due to an error."
      );
    } finally {
      setDeletingMemberId(null);
    }
  }

  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 py-3.5 px-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-slate-900">
                Trip Members & Companions
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold border-blue-200 bg-blue-50 text-blue-700"
              >
                {members.length} {members.length === 1 ? "Member" : "Members"}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Manage travelers sharing expenses and splitting costs.
            </CardDescription>
          </div>
        </div>

        {!isAddingOpen && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsAddingOpen(true);
              setAddError(null);
              setDeleteError(null);
            }}
            className="text-xs h-7 gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
          >
            <UserPlus className="h-3 w-3" />
            Add Companion
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Delete Error Notification */}
        {deleteError && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Unable to remove companion</p>
              <p className="text-[11px] mt-0.5 text-rose-700">{deleteError}</p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold px-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Add Companion Form Drawer */}
        {isAddingOpen && (
          <form
            onSubmit={handleAddMember}
            className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-3 text-xs animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-900 flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-blue-600" />
                Add New Travel Companion
              </span>
              <button
                type="button"
                onClick={() => setIsAddingOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                Cancel
              </button>
            </div>

            {addError && (
              <div className="p-2 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-[11px] flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                <span>{addError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                  Name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Maya Chen"
                  maxLength={100}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. maya@example.com"
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingOpen(false)}
                className="h-7 text-xs text-slate-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Save Companion"
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Members List */}
        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading group members...
          </div>
        ) : members.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 italic">
            No companions added yet. Click &quot;Add Companion&quot; to split costs with travel partners.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {members.map((member) => {
              const isOwner = member.role === "owner";
              const isDeleting = deletingMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50/70 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                        isOwner
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {isOwner ? (
                        <Crown className="h-3.5 w-3.5" />
                      ) : (
                        member.display_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900 truncate">
                          {member.display_name}
                        </span>
                        {isOwner ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-blue-200 bg-blue-50 text-blue-700 font-bold"
                          >
                            Trip Organizer
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-slate-200 text-slate-600"
                          >
                            Companion
                          </Badge>
                        )}
                      </div>

                      {member.email && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate mt-0.5">
                          <Mail className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOwner ? (
                      <span className="text-[10px] text-slate-400 italic px-2">
                        Primary
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteMember(member)}
                        disabled={isDeleting}
                        className="h-7 w-7 p-0 text-slate-300 hover:text-rose-600 transition-colors"
                        title={`Remove ${member.display_name}`}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

