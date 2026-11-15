import { guardedAuthHandler } from "@/server/auth/handler";
import { getAuth } from "@/server/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try { return await guardedAuthHandler(r=>getAuth().handler(r))(request); }
  catch { return Response.json({ error: "authentication_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } }); }
}
export const GET = handle;
export const POST = handle;
