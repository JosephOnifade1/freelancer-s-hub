# Phase 1.1 — Supabase SSR Cookie Session Migration

Branch `arena/df0a2522-freelancer-s-hub`, based on `0033fcc` (`migration/nextjs-app-router`).
`main` untouched. Supabase Auth retained — no Neon, no Drizzle, no schemas, no data migration.

**Verification class:** TypeScript, ESLint, Vitest (jsdom + node), both production builds, the Vite
rollback build, and HTTP smoke against `next start` in two configurations. **No real browser and no
live Supabase project were available.** Nothing below claims a successful live auth round trip.

---

## 1. Before and after

### Before (Phase 1)

```
Browser (localStorage)                    Server
┌──────────────────────┐                 ┌──────────────────────┐
│ supabase-js client   │                 │ (no idea who you are)│
│ session in           │                 │                      │
│ localStorage         │                 │ every page is a      │
│        ↓             │                 │ client shell;        │
│ AuthProvider reads it│                 │ AuthGate redirects   │
│ AuthGate redirects   │  ← HTML ─────── │ after hydration      │
└──────────────────────┘                 └──────────────────────┘
```

The session never left the browser. `AuthGate` was the only protection, and it ran *after* the shell
had been delivered. Server Components, route handlers and server actions could not see a user.

### After (Phase 1.1)

```
Browser                                   Proxy (src/proxy.ts)         Server
┌───────────────────────┐  request  ┌────────────────────────┐  ┌─────────────────────┐
│ @supabase/ssr browser │ ────────→ │ reads session cookies  │  │ createServerClient  │
│ client: session in    │           │ refreshes if expired   │  │ getUser() verified  │
│ COOKIES (not local-   │ ←──────── │ rotates cookies onto   │  │ session available   │
│ Storage)              │  response │ request + response     │  │ to RSC / handlers   │
│        ↓              │           │                        │  │                     │
│ AuthProvider +        │           │ protected + anon       │  │ /auth/callback:     │
│ AuthGate (layer 2)    │           │ → /login?from=… (307)  │  │ exchangeCode…       │
└───────────────────────┘           └────────────────────────┘  └─────────────────────┘
```

The cookie session is now the **canonical** session. There is exactly one client per environment, one
refresh path, and no second identity source.

---

## 2. Supabase client architecture

| Layer | Module | Storage | Used by |
| --- | --- | --- | --- |
| Credential resolution | `src/lib/supabase-env.ts` | — | everyone (no browser globals, no SDK) |
| Browser client | `src/lib/supabase.ts` | **cookies** via `@supabase/ssr` `createBrowserClient` | Login, Signup, OAuth initiation, AuthProvider, all client data calls |
| Server client | `src/lib/supabase-server.ts` | reads/writes request cookies via `createServerClient` + `next/headers` | Server Components (future), route handlers, `/auth/callback` |
| Request refresh | `src/proxy.ts` | reads + rotates cookies on request *and* response | every request (matcher below) |
| OAuth callback | `src/app/auth/callback/route.ts` | `exchangeCodeForSession` → sets cookies | the provider's redirect |

**Cookie/session flow.** Sign-in writes `sb-*-auth-token` cookies from the browser client. Every
subsequent request carries them; the proxy reads them, refreshes the access token when it has expired,
and writes the rotated cookies to both the forwarded request (so Server Components in the *same*
request see the fresh session) and the response (so the browser persists it). `/auth/callback` exchanges
the OAuth code server-side — the one place cookies are *established* rather than merely read.

**Preserved deliberately.** `src/lib/supabase.ts` keeps its exact public surface (`supabase`,
`isDemoMode`), so the 30 files importing it — every `lib/*.ts` data module and every view — needed no
change. Credential resolution moved to `supabase-env.ts` rather than being duplicated.

**No secrets.** Only `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are read, as literal
expressions so Next can inline them. No service-role key is read anywhere, and no environment value is
reproduced in this report. The `createClient` (localStorage-default) call survives only on the
prerender/Vitest branch, which holds no session.

**Demo mode is unchanged in kind.** `NEXT_PUBLIC_DEMO_MODE=true` still runs the browser-local mock with
its own localStorage session and installs no cookie session; the proxy detects the unconfigured case and
stays inert.

---

## 3. Route protection

Classified from the real `src/app/**` tree and cross-checked against what the legacy Vite table wraps in
`ProtectedRoute`. The inventory lives in `src/lib/route-access.ts` and is imported by both the proxy and
the tests, so they cannot drift.

### Public (21 verified anonymously in smoke)

`/` · `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/new` · `/popular` ·
`/leaderboard` · `/communities` · `/pricing` · `/status` · `/privacy` · `/terms` · `/l` ·
prefixes `/b/`, `/p/`, `/f/`, `/u/`, `/l/`, `/tag/`

Borynx is read-open by design — public profiles, posts, communities and opportunities stay reachable
while signed out (the board even says "browse without an account"). Gating these would break the
product, not secure it.

### Protected (15, all redirected anonymously in smoke)

`/onboarding` `/submit` `/pipeline` `/applications` `/notifications` `/admin` `/bookmarks`
`/achievements` `/my-reports` `/settings` `/drafts` `/premium` `/l/post` `/f/me` `/following`

### Mechanism — two layers, intentionally

| Layer | Where | What it guarantees |
| --- | --- | --- |
| **1. Request-level** | `src/proxy.ts` | An anonymous request for a protected path receives a 307 to `/login?from=<path>` and **never any HTML**. Also refreshes the session on every request. |
| **2. Client** | `src/components/AuthGate.tsx` | A client-side transition on an already-loaded page cannot paint a private subtree; demo mode remains protected. |

The proxy matcher covers page navigations only — `_next/static`, `_next/image`, `favicon.ico` and any
request with a static-asset extension are excluded, so no asset is ever intercepted.

---

## 4. AuthGate status — **kept (option A: client-side UX fallback), not reduced**

Verified reasons, not defaults:

1. **Client-side transitions.** The proxy runs on real requests only. `next/link` navigation on an
   already-loaded page would render the private subtree before any redirect. `AuthGate` returns `null`
   instead, so private content never paints — this is the "no protected content flash" requirement, and
   the proxy cannot satisfy it alone.
2. **Demo mode.** The mock backend has no cookie session, so the proxy is inert there by design.
   `AuthGate` is the *only* protection in that mode.
3. **Unconfigured builds.** Same as demo: the proxy returns early, `AuthGate` holds the line.
4. **No added cost.** It reads `AuthProvider` state; it does not fetch the session again (asserted by a
   test: one `getUser()` per request in the proxy, one `getSession()` per mount in the provider).

It was not removed from any route. The goal was correct layered protection, not zero usage.

---

## 5. Files changed

**New**

| File | Why |
| --- | --- |
| `src/lib/supabase-env.ts` | Credential resolution with no browser globals, so `proxy.ts` and server modules can import it. Keeps the literal `NEXT_PUBLIC_*` reads. |
| `src/lib/supabase-server.ts` | `createSupabaseServerClient()` + `getServerUser()` using `createServerClient` and `next/headers`; verifies with `getUser()`. |
| `src/lib/route-access.ts` | The public/protected inventory — the single source of truth for the proxy and the tests. |
| `src/lib/oauth.ts` | `oauthCallbackUrl()` — builds the provider redirect to `/auth/callback?next=<validated>`. |
| `src/proxy.ts` | Next 16 `proxy` convention: session refresh + protected-route gating. |
| `src/app/auth/callback/route.ts` | Exchanges the OAuth code server-side and forwards to the validated destination. |
| `src/test/phase1.1-route-access.test.ts` | 11 tests: inventory correctness, no over-matching, proxy/inventory agreement. |
| `src/test/phase1.1-proxy-session.test.ts` | 12 tests: anonymous/authenticated gating, one `getUser()` per request, no-op when unconfigured, no loops. |
| `src/test/phase1.1-auth-callback.test.ts` | 20 tests: code exchange, destination validation, missing parameters, failure paths. |
| `src/test/phase1.1-session-architecture.test.ts` | 14 tests: cookie client, server client isolation, single sanitizer, single client factory, layered guard. |

**Modified**

| File | Change |
| --- | --- |
| `src/lib/supabase.ts` | Uses `createBrowserClient` (cookie storage) in the browser; keeps plain `createClient` for prerender/Vitest; credentials now come from `supabase-env.ts`. Public surface unchanged. |
| `src/views/Login.tsx`, `src/views/Signup.tsx` | OAuth `redirectTo` now targets `/auth/callback?next=<validated>` instead of the destination page. UI untouched. |
| `src/components/AuthGate.tsx` | Documentation rewritten to record why it is kept as layer 2 (behaviour unchanged). |
| `src/test/setup.ts` | `matchMedia` shim guarded by `typeof window`, so node-environment suites can share the setup file. |
| `src/test/phase02-env.test.ts` | Assertions follow the env contract to its new module, plus a new check that the browser client reads no env itself. |

**Untouched:** `src/lib/return-path.ts` (the validation contract is reused verbatim), all UI, all data
modules, `src/App.tsx`, `react-router-dom`, the Vite build, `main`.

---

## 6. Validation results

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | **0 errors** |
| `npx tsc -p tsconfig.legacy.json --noEmit` | **0 errors** |
| `npx eslint src` | **0 errors**, 6 pre-existing `react-refresh` warnings (unchanged baseline) |
| `npx vitest run` | **236 passed / 236**, 22 files |
| `npm run build:next` (Turbopack) | success — `ƒ Proxy (Middleware)` registered, 36 pages |
| `npm run build:next:webpack` | success — `ƒ Proxy (Middleware)` registered, 36 pages |
| `npm run build:legacy` (Vite) | success |
| Route smoke — unconfigured | 33/33 routes served; `/auth/callback` 307s without a code |
| Route smoke — configured | **15/15 protected → 307 `/login?from=…`**, **21/21 public → 200** |
| Redirect-loop check | `/settings` → `/login?from=%2Fsettings` in **1 hop**, terminating at 200; `/login?from=…` itself 0 hops |
| Callback | no code → `/login?auth_error=missing_code`; bad code → `…exchange_failed&from=%2Fpipeline`; hostile `next` → falls back to `/` |

New tests: **57** (11 + 12 + 20 + 14). All 41 return-path tests still pass unchanged.

---

## 7. Live verification gaps

These need infrastructure this environment does not have:

1. **Real browser** — nothing here was verified visually or interactively. In particular: cookies
   actually persisting across reload, `next/link` client transitions hitting `AuthGate` rather than the
   proxy, and the `?from=` round trip end-to-end.
2. **Live Supabase credentials** — a real `getUser()` JWT verification, a real token refresh producing
   rotated `Set-Cookie` headers, and `exchangeCodeForSession` against a real project. The proxy tests
   stub `createServerClient`; the callback tests stub the exchange. **No live Supabase authentication was
   tested.**
3. **OAuth provider configuration** — Google must have `https://<host>/auth/callback` in its allowed
   redirect URLs, and the Supabase project's *Site URL* / redirect allow-list must include it. Without
   that the round trip fails at the provider, not in this code. This could not be inspected from here.
4. **Email confirmation / recovery links** — behaviour still depends on the project's dashboard
   settings. `/reset-password` continues to use the implicit/PKCE flow the Supabase client provides;
   that path was not re-verified against a live project.
5. **`next start` origin artefact** — the callback's redirect `Location` shows the bind address
   (`0.0.0.0`) in this sandbox. That is a server-start artefact of this environment, not app code; on a
   real host the origin comes from the request.

---

## 8. Recommended next phase

**Phase 2 — server-side data access.** The session is now server-readable, which is what unlocks the
original motivation. Concretely:

1. Move the first genuinely server-rendered page (a private one, e.g. `/settings` or `/notifications`)
   from `dynamic(..., { ssr: false })` to a Server Component reading `getServerUser()` — this exercises
   the whole chain and removes one client round trip.
2. Once one page proves the chain, consider promoting `/auth/callback`-style handling and per-route
   layouts with server checks, and let `AuthGate` shrink where the server genuinely renders the private
   content.
3. Keep `?from=` and `sanitizeReturnPath` as-is; they are now used by the proxy *and* the callback, so
   they should not be touched casually.

Application-data boundaries (profiles in the Supabase `profiles` table, the later Neon + Drizzle split)
remain a separate phase and are still out of scope here.

---

## Awaiting approval

No further work has been started. Changes are uncommitted on `arena/df0a2522-freelancer-s-hub`.
