import { NextResponse } from "next/server";
import { trustRequest } from "@/server/features/trust";
import { TrustError } from "@/server/features/trust/trust-queries";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    let body: Record<string, unknown> = {};
    if (!["GET", "DELETE"].includes(request.method)) {
      try {
        const parsed = await request.json();
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error();
        body = parsed;
      } catch {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
      }
    }
    const data = await trustRequest(
      request.method,
      new URL(request.url).searchParams,
      body,
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof TrustError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    const code =
      (error as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (error as { code?: string })?.code;
    if (code === "23505")
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    if (code === "23503")
      return NextResponse.json({ error: "invalid_reference" }, { status: 400 });
    console.error("[trust] request failed", { code: code ?? "unknown" });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
