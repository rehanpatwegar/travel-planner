import Link from "next/link";
import { Compass, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8">
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
          Enter your registered email address and we will send you a reset link.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border-slate-200 bg-white p-2 shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg">Password Recovery</CardTitle>
            <CardDescription className="text-xs">
              We&apos;ll email you verification instructions to reset your account credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Email Address</label>
              <Input
                type="email"
                placeholder="traveler@example.com"
                required
                className="h-10 text-sm"
              />
            </div>

            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium">
              <Mail className="mr-2 h-4 w-4" />
              Send Reset Link
            </Button>

            <div className="mt-4 text-center text-xs">
              <Link href="/login" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

