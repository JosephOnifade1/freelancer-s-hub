import "server-only";
import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export interface AuthEmail { to: string; subject: string; url: string; purpose: "verification" | "password-reset" }
/** Provider-neutral delivery gateway contract. No tokens/addresses/links in logs.
 * File outbox is loopback development only, private permissions and gitignored.
 * Gateway must implement this JSON contract; it is NOT an arbitrary provider SDK. */
export async function deliverAuthEmail(mail: AuthEmail) {
  const mode = process.env.EMAIL_DELIVERY_MODE ?? "disabled";
  if (mode === "file" && process.env.NODE_ENV === "development" && process.env.BORYNX_ENVIRONMENT === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.BETTER_AUTH_URL!).hostname)) {
    const dir = join(process.cwd(), ".local", "auth-outbox");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const file = await open(join(dir, `${randomUUID()}.json`), "wx", 0o600);
    try { await file.writeFile(JSON.stringify(mail)); } finally { await file.close(); }
    return;
  }
  if (mode !== "gateway" || !process.env.EMAIL_GATEWAY_URL || !process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) throw new Error("email_delivery_not_configured");
  const endpoint = new URL(process.env.EMAIL_GATEWAY_URL);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("email_gateway_invalid");
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.EMAIL_API_KEY}` }, body: JSON.stringify({ ...mail, from: process.env.EMAIL_FROM }), signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!response.ok) throw new Error("email_delivery_unavailable");
}
