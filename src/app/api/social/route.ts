import { NextResponse } from "next/server";
import { socialRequest } from "@/server/features/social";
import { SocialError } from "@/server/features/social/social-queries";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      try {
        const parsed = await request.json();
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        body = parsed;
      } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
    }
    const data = await socialRequest(request.method, new URL(request.url).searchParams, body);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof SocialError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code;
    if (code === "23505") return NextResponse.json({ error: "conflict" }, { status: 409 });
    // Do not disclose SQL parameters, connection details, or protected row contents.
    console.error("[social] request failed", { code: code ?? "unknown" });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
