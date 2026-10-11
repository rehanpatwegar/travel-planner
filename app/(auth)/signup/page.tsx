"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDuplicateUser, setIsDuplicateUser] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsDuplicateUser(false);

    // Validation
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg("Please enter your full name (minimum 2 characters).");
      return;
    }

    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify both fields.");
      return;
    }

    setLoading(true);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
          emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
        },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("already registered") ||
          error.message.toLowerCase().includes("user already exists")
        ) {
          setIsDuplicateUser(true);
          setErrorMsg("An account with this email already exists.");
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      // Check if email confirmation is required or if a session was created immediately
      if (data?.session) {
        // User is immediately authenticated.
        // Attempt to ensure profile entry in profiles table exists (handled automatically by schema trigger, with safe upsert fallback)
        try {
          await supabase.from("profiles").upsert(
            {
              id: data.user!.id,
              full_name: trimmedName,
            },
            { onConflict: "id" }
          );
        } catch {
          // Trigger handles profile creation if RLS prevents manual upsert
        }

        window.location.href = "/dashboard";
      } else if (data?.user) {
        // Email confirmation flow is enabled in Supabase project
        setConfirmationSent(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during signup.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
            <Compass className="h-5 w-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">GlobeTrotter</span>
        </Link>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Create your account
        </h2>
        <p className="mt-1.5 text-xs text-slate-600">
          Plan personalized multi-city trips with intelligent assistance.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {confirmationSent ? (
          <Card className="border-slate-200 bg-white p-6 shadow-md text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-4">
              <Mail className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription className="mt-2 text-xs text-slate-600 leading-relaxed">
              We&apos;ve sent a verification link to <strong className="text-slate-900">{email}</strong>. Please click the link to confirm your account and start planning your trips.
            </CardDescription>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <Link href="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Proceed to Sign In
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setConfirmationSent(false)}
                className="text-xs text-slate-500 hover:text-slate-700 py-1"
              >
                Use a different email address
              </button>
            </div>
          </Card>
        ) : (
          <Card className="border-slate-200 bg-white shadow-md">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg">Sign up for GlobeTrotter</CardTitle>
              <CardDescription className="text-xs">
                Fill in the details below to begin crafting your itineraries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorMsg && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <p>{errorMsg}</p>
                    {isDuplicateUser && (
                      <Link href="/login" className="mt-1 inline-block font-semibold underline hover:text-rose-900">
                        Sign in to existing account →
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Full Name</label>
                  <Input
                    type="text"
                    placeholder="Jane Traveler"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  <Input
                    type="email"
                    placeholder="traveler@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <Input
                    type="password"
                    placeholder="At least 6 characters"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Confirm Password</label>
                  <Input
                    type="password"
                    placeholder="Repeat your password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="h-10 text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-4 text-center text-xs text-slate-500">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-800">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Your private itineraries are protected with Row Level Security.</span>
        </div>
      </div>
    </div>
  );
}
