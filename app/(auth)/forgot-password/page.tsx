"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Compass, ArrowLeft, Mail, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successSent, setSuccessSent] = useState(false);

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setSuccessSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send password reset request.";
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
          Reset your password
        </h2>
        <p className="mt-1.5 text-xs text-slate-600">
          Enter your registered email address to receive password recovery instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {successSent ? (
          <Card className="border-slate-200 bg-white p-6 shadow-md text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Check your inbox</CardTitle>
            <CardDescription className="mt-2 text-xs text-slate-600 leading-relaxed">
              We&apos;ve sent password reset instructions to <strong className="text-slate-900">{email}</strong>.
              Click the link inside to set a new password.
            </CardDescription>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <Link href="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Return to Sign In
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setSuccessSent(false)}
                className="text-xs text-slate-500 hover:text-slate-700 py-1"
              >
                Send to a different email address
              </button>
            </div>
          </Card>
        ) : (
          <Card className="border-slate-200 bg-white shadow-md">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg">Password Recovery</CardTitle>
              <CardDescription className="text-xs">
                We will email you a secure link to update your account password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorMsg && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-3.5">
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

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Reset Link
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-4 text-center text-xs">
                <Link href="/login" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
