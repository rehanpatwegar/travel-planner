import { NextRequest, NextResponse } from "next/server";
import { POST as assistantPOST } from "../assistant/route";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return assistantPOST(request);
}
