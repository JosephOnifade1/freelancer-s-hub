import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
/** Retired Phase 2H: reputation changes only in the authoritative vote transaction. */
export async function POST(_request: Request) {
  return NextResponse.json({error:"retired",message:"Reputation is maintained by voting."},{status:410});
}
