import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
/** Retired in Phase 2E. Counters may only change with a follow relationship. */
export async function POST() {
  return NextResponse.json({ error: "retired", message: "Use the follow endpoint." }, { status: 410 });
}
