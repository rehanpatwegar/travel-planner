"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  ArrowLeft,
  User,
  Mail,
  DollarSign,
  Shield,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [bio, setBio] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Unauthenticated: redirect to login
          window.location.href = "/login?redirect=/profile";
          return;
        }

        setUserId(user.id);
        setEmail(user.email || "");

        // Fetch profile record
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profile) {
          setFullName(profile.full_name || user.user_metadata?.full_name || "");
          setHomeCurrency(profile.home_currency || "USD");
          setBio(profile.bio || "");
        } else {
          // If profile row hasn't been created yet, use metadata
          setFullName(user.user_metadata?.full_name || "");
        }
      } catch (err: unknown) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserProfile();
  }, [supabase]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName.trim(),
          home_currency: homeCurrency.toUpperCase().trim(),
          bio: bio.trim(),
        },
        { onConflict: "id" }
      );

      if (error) {
        setErrorMsg(error.message);
        return;
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
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

          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl">
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
            <Card className="mt-8 border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Personal Details</CardTitle>
                <CardDescription className="text-xs">
                  Your identity is linked to your authenticated session and protected by Row Level Security.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {errorMsg && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <p>{errorMsg}</p>
                  </div>
                )}

                {successMsg && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                    <p>{successMsg}</p>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Full Name</label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Traveler"
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
                    <p className="text-[11px] text-slate-400">Email is managed by Supabase Auth.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Default Currency</label>
                    <Input
                      value={homeCurrency}
                      onChange={(e) => setHomeCurrency(e.target.value)}
                      maxLength={3}
                      placeholder="USD"
                      className="h-10 text-sm uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Bio / Travel Interests</label>
                    <Input
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
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
          )}
        </div>
      </main>
    </div>
  );
}
