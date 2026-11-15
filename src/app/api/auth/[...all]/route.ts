import { publicAuthConfiguration } from "@/server/auth/public-configuration";
import { guardedAuthHandler } from "@/server/auth/handler";
import { getAuth } from "@/server/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const mailRoutes = ["/sign-up/email", "/send-verification-email", "/request-password-reset"];
async function handle(request: Request) {
  try {
    return await guardedAuthHandler(async request => {
      // Refuse before signup inserts an unverified user when delivery is disabled.
      // This is configuration readiness, not a guarantee of gateway delivery.
      if (request.method === "POST" && mailRoutes.some(path => new URL(request.url).pathname === `/api/auth${path}`)
        && publicAuthConfiguration().emailDelivery === "unavailable") {
        return Response.json({ code: "EMAIL_DELIVERY_NOT_CONFIGURED", message: "Email delivery is not configured. Configure EMAIL_DELIVERY_MODE=file for local testing, or a real email gateway." },
          { status: 503, headers: { "cache-control": "no-store" } });
      }
      return getAuth().handler(request);
    })(request);
  } catch {
    return Response.json({ error: "authentication_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
