"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowLeft,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const POPULAR_CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD", "CHF"];

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [bio, setBio] = useState("");

  // User travel statistics
  const [tripCount, setTripCount] = useState(0);
  const [stopsCount, setStopsCount] = useState(0);
  const [itemsCount, setItemsCount] = useState(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login?redirect=/profile";
          return;
        }

        setUserId(user.id);
        setEmail(user.email || "");

        // Fetch profile record
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          setFullName(profile.full_name || user.user_metadata?.full_name || "");
          setAvatarUrl(profile.avatar_url || user.user_metadata?.avatar_url || "");
          setHomeCurrency(profile.home_currency || "USD");
          setBio(profile.bio || "");
        } else {
          setFullName(user.user_metadata?.full_name || "");
          setAvatarUrl(user.user_metadata?.avatar_url || "");
        }

        // Fetch user travel summary stats
        const { data: trips } = await supabase
          .from("trips")
          .select("id")
          .eq("user_id", user.id);

        const userTrips = trips || [];
        setTripCount(userTrips.length);

        if (userTrips.length > 0) {
          const tripIds = userTrips.map((t) => t.id);
          const { count: sCount } = await supabase
            .from("trip_stops")
            .select("id", { count: "exact", head: true })
            .in("trip_id", tripIds);
          setStopsCount(sCount || 0);

          const { count: iCount } = await supabase
            .from("itinerary_items")
            .select("id", { count: "exact", head: true })
            .in("trip_id", tripIds);
          setItemsCount(iCount || 0);
        }
      } catch (err: unknown) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserProfile();
  }, [supabase]);

  // Compute initials for avatar fallback
  const initials = fullName
    ? fullName
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : email.slice(0, 2).toUpperCase() || "GT";

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // Form validation
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setErrorMsg("Full name is required.");
      return;
    }
    if (trimmedName.length > 100) {
      setErrorMsg("Full name must be under 100 characters.");
      return;
    }

    const trimmedCurrency = homeCurrency.trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(trimmedCurrency)) {
      setErrorMsg("Please enter a valid 2 or 3-letter currency code (e.g. USD, EUR, INR, GBP).");
      return;
    }

    const trimmedAvatar = avatarUrl.trim();
    if (
      trimmedAvatar &&
      !trimmedAvatar.startsWith("http://") &&
      !trimmedAvatar.startsWith("https://")
    ) {
      setErrorMsg("Avatar URL must be a valid HTTP or HTTPS web address.");
      return;
    }

    if (bio.trim().length > 500) {
      setErrorMsg("Bio / Travel Interests must be under 500 characters.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: trimmedName,
          avatar_url: trimmedAvatar || null,
          home_currency: trimmedCurrency,
          bio: bio.trim() || null,
        },
        { onConflict: "id" }
      );

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMsg("Profile settings updated successfully.");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
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
            <span className="text-sm font-medium text-slate-600">User Profile</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/trips">
              <Button variant="ghost" size="sm" className="text-xs">
                My Trips
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-xs">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="border-b border-slate-200 pb-5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Profile & Account Settings
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Manage your personal information, travel preferences, and home currency.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-3 text-xs font-medium">Loading profile details...</p>
            </div>
          ) : (
            <>
              {/* User Travel Statistics Summary Card */}
              <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-center p-2">
                  <span className="text-2xl font-bold text-slate-900">{tripCount}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Trips Planned</p>
                </div>
                <div className="text-center p-2 border-x border-slate-100">
                  <span className="text-2xl font-bold text-blue-600">{stopsCount}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Destinations / Stops</p>
                </div>
                <div className="text-center p-2">
                  <span className="text-2xl font-bold text-indigo-600">{itemsCount}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Activities Scheduled</p>
                </div>
              </div>

              {/* Status Notifications */}
              {errorMsg && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <p>{successMsg}</p>
                </div>
              )}

              {/* Personal Details Form */}
              <Card className="border-slate-200 bg-white shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base">Personal Details</CardTitle>
                  <CardDescription className="text-xs">
                    Your identity is linked to your authenticated session and protected by Row Level Security.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    {/* Avatar Display & Input */}
                    <div className="flex items-center gap-4 pb-2">
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg overflow-hidden border-2 border-slate-200 shadow-xs">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarUrl}
                            alt="User Avatar"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : null}
                        <span>{initials}</span>
                      </div>

                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Avatar Image URL
                        </label>
                        <Input
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          placeholder="https://example.com/avatar.jpg"
                          className="h-9 text-xs"
                        />
                        <p className="text-[11px] text-slate-400">
                          Enter a direct image link (PNG, JPG, WebP) to display your profile picture.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Full Name</label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Traveler"
                        maxLength={100}
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Email Address</label>
                      <Input
                        value={email}
                        disabled
                        className="h-10 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                      />
                      <p className="text-[11px] text-slate-400">
                        Email is managed by Supabase Auth and cannot be modified directly here.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Default Currency
                        </label>
                        <span className="text-[11px] text-slate-400">
                          Used for default budget calculations
                        </span>
                      </div>
                      <Input
                        value={homeCurrency}
                        onChange={(e) => setHomeCurrency(e.target.value.toUpperCase())}
                        maxLength={3}
                        placeholder="USD"
                        className="h-10 text-sm uppercase font-mono"
                      />
                      {/* Currency quick selection pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-slate-400 mr-1">Quick select:</span>
                        {POPULAR_CURRENCIES.map((curr) => (
                          <button
                            key={curr}
                            type="button"
                            onClick={() => setHomeCurrency(curr)}
                            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              homeCurrency === curr
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {curr}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">
                          Bio / Travel Interests
                        </label>
                        <span className="text-[10px] text-slate-400">
                          {bio.length}/500
                        </span>
                      </div>
                      <Input
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={500}
                        placeholder="Food lover, art history enthusiast, scenic hiker..."
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleSignOut}
                        disabled={loggingOut}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        {loggingOut ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Signing Out...
                          </>
                        ) : (
                          <>
                            <LogOut className="mr-1.5 h-3.5 w-3.5" />
                            Sign Out
                          </>
                        )}
                      </Button>

                      <Button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium h-9"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Danger Zone: Account Deletion */}
              <Card className="border-rose-200 bg-rose-50/30 shadow-xs">
                <CardHeader>
                  <CardTitle className="text-base text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    Account Security & Deletion
                  </CardTitle>
                  <CardDescription className="text-xs text-rose-700/80">
                    Important security notice regarding user account removal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-700 leading-relaxed">
                  <p>
                    To prevent client-side credential hijacking and satisfy Supabase Auth security constraints, permanent user deletion requires the Supabase service-role administrative API (<code className="font-mono bg-rose-100 text-rose-900 px-1 rounded">supabase.auth.admin.deleteUser(uid)</code>) or administrative dashboard access.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Client applications must never expose privileged service-role credentials. If you wish to delete your account, sign out and contact the platform administrator or submit a deletion request.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
