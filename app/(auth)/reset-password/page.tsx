"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, KeyRound, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validatingSession, setValidatingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setHasValidSession(true);
        } else {
          setHasValidSession(false);
        }
      } catch {
        setHasValidSession(false);
      } finally {
        setValidatingSession(false);
      }
    }
    checkSession();
  }, [supabase]);

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

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
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
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
          Set New Password
        </h2>
        <p className="mt-1.5 text-xs text-slate-600">
          Enter a new secure password for your GlobeTrotter account.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {validatingSession ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="mt-3 text-xs">Validating recovery link...</p>
          </div>
        ) : !hasValidSession ? (
          <Card className="border-slate-200 bg-white p-6 shadow-md text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">Recovery Link Expired or Invalid</CardTitle>
            <CardDescription className="mt-2 text-xs text-slate-600 leading-relaxed">
              This password reset link is invalid, already used, or has expired. Please request a new recovery link.
            </CardDescription>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
              <Link href="/forgot-password">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Request New Reset Link
                </Button>
              </Link>
              <Link href="/login" className="text-xs text-slate-500 hover:text-slate-700 py-1">
                Return to Sign In
              </Link>
            </div>
          </Card>
        ) : success ? (
          <Card className="border-slate-200 bg-white p-6 shadow-md text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Password Updated</CardTitle>
            <CardDescription className="mt-2 text-xs text-slate-600 leading-relaxed">
              Your password has been changed successfully. Redirecting you to your dashboard...
            </CardDescription>
          </Card>
        ) : (
          <Card className="border-slate-200 bg-white shadow-md">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-lg">Enter New Password</CardTitle>
              <CardDescription className="text-xs">
                Your new password must be at least 6 characters long.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorMsg && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">New Password</label>
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
                  <label className="text-xs font-semibold text-slate-700">Confirm New Password</label>
                  <Input
                    type="password"
                    placeholder="Repeat your new password"
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
                      Updating password...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Save New Password
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

