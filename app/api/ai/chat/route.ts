import { NextRequest, NextResponse } from "next/server";
import { POST as assistantPOST } from "../assistant/route";

export const dynamic = "force-dynamic";

/**
 * AI Chat Route
 * Forwards chat inquiries to the centralized AI Assistant handler.
 * Inherits all authentication, trip ownership, rate limiting, and Gemini reliability rules.
 */
export async function POST(request: NextRequest) {
  try {
    return await assistantPOST(request);
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Internal server error in AI chat route.";
    console.error("AI Chat route error:", errorMsg);

    return NextResponse.json(
      { error: "An unexpected error occurred while processing your chat request." },
      { status: 500 }
    );
  }
}
