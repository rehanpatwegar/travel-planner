import Link from "next/link";
import { Compass, ArrowLeft, User, Mail, DollarSign, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ProfilePage() {
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

          <Card className="mt-8 border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Personal Details</CardTitle>
              <CardDescription className="text-xs">
                Stored in the profiles table linked to your authenticated session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Full Name</label>
                <Input defaultValue="Travel Enthusiast" className="h-10 text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Email Address</label>
                <Input defaultValue="traveler@example.com" disabled className="h-10 text-sm bg-slate-50 text-slate-500" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Home Currency</label>
                <Input defaultValue="USD" className="h-10 text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Bio / Travel Style</label>
                <Input defaultValue="Passionate about architecture, scenic rail trips, and local culinary experiences." className="h-10 text-sm" />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                    Sign Out
                  </Button>
                </Link>

                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

