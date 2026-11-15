import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import * as tables from "../db/schema/auth";
import { authConfiguration } from "./config";
import type { AuthEmail } from "../email";
/** Factory accepts the shared Drizzle instance; no independent connection. */
export function createBorynxAuth(db: Parameters<typeof drizzleAdapter>[0], sendEmail: (mail: AuthEmail) => Promise<void>, env: NodeJS.ProcessEnv = process.env, cookies = true) {
  const config = authConfiguration(env);
  return betterAuth({
    appName: "Borynx", baseURL: config.baseURL, secret: config.secret, trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(db, { provider: "pg", transaction: true, schema: { ...tables } }),
    advanced: { database: { generateId: "uuid" }, useSecureCookies: config.secure, cookiePrefix: "borynx", defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" } },
    user: { modelName: "authUsers", deleteUser: { enabled: false } },
    session: { modelName: "authSessions", expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, freshAge: 60 * 5, cookieCache: { enabled: false } },
    account: { modelName: "authAccounts", encryptOAuthTokens: true, accountLinking: { enabled: true, disableImplicitLinking: true, allowDifferentEmails: false } },
    verification: { modelName: "authVerifications" },
    emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 12, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendEmail({ to: user.email, url, subject: "Reset your Borynx password", purpose: "password-reset" }) },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => sendEmail({ to: user.email, url, subject: "Verify your Borynx email", purpose: "verification" }) },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" } } : {},
    rateLimit: { enabled: true, storage: "database", modelName: "authRateLimits", window: 60, max: 60, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 300, max: 5 }, "/request-password-reset": { window: 300, max: 3 }, "/send-verification-email": { window: 300, max: 3 } } },
    // Avoid logging library/provider exceptions, which can contain tokens/SQL.
    logger: { disabled: true }, plugins: cookies ? [nextCookies()] : [],
  });
}
