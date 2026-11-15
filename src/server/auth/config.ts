/** Pure configuration, also used by the explicitly invoked local owner tools. */
export function authConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.DATABASE_URL && env.BETTER_AUTH_SECRET && env.BETTER_AUTH_URL);
}
export function authConfiguration(env: NodeJS.ProcessEnv = process.env) {
  if (!authConfigured(env) || env.BETTER_AUTH_SECRET!.length < 32) throw new Error("auth_configuration_invalid");
  const base = new URL(env.BETTER_AUTH_URL!);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || base.pathname !== "/" || (base.protocol !== "https:" && !(local && env.NODE_ENV !== "production" && base.protocol === "http:"))) throw new Error("auth_origin_invalid");
  const origins = [base.origin, ...(env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean)];
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || origin.includes("*") || url.username || url.password || (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.protocol === "http:"))) throw new Error("auth_origin_invalid");
  }
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) throw new Error("google_configuration_incomplete");
  return { baseURL: base.origin, secret: env.BETTER_AUTH_SECRET!, trustedOrigins: [...new Set(origins)], secure: base.protocol === "https:" };
}
export function trustedMutation(request: Request, env: NodeJS.ProcessEnv = process.env) {
  try { const config = authConfiguration(env); return request.headers.get("origin") !== null && config.trustedOrigins.includes(request.headers.get("origin")!); } catch { return false; }
}
