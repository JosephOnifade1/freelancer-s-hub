# Phase 1.2 — Server-Rendered Private Page Proof

Branch `arena/8bcaaf16-freelancer-s-hub`, based on `1b19a02` (`migration/nextjs-app-router`).
`main` untouched. One private page converted; nothing else. No Neon, no Drizzle, no schemas, no data
migration, no redesign.

**Verification class:** TypeScript, ESLint, Vitest (jsdom + node), both Next production builds, the Vite
rollback build, and HTTP smoke against `next start` in two configurations. **No real browser and no live
Supabase project were available** — no claim below rests on a live JWT verification.

---

## 1. Selected page — `/settings`

Preferred candidate, and it holds up on inspection:

| Candidate | Blockers | Verdict |
| --- | --- | --- |
| **Settings** | No TipTap, no Framer Motion of its own, no `window`/`localStorage` access in the view; its identity needs (email, verification) come straight from the session | **Selected** |
| Drafts | Reads `localStorage` in `useState` initialiser — browser-only by nature | Rejected |
| Bookmarks | Composes `PostCard` (motion + interactive), heavier client tree | Rejected |
| Notifications | Polls/refetches; would have added a data concern to an architecture proof | Rejected |
| Achievements | 561 lines, motion-heavy | Rejected |
| MyReports | 206 lines, moderation data | Rejected |

Settings is the safest *and* the most valuable: it is the page most tightly coupled to identity, so
proving it server-side proves the pattern where it matters.

---

## 2. Before and after

### Before (Phase 1.1)

```
Request /settings
   ↓ proxy.ts: no session → 307 /login?from=%2Fsettings     (anonymous)
   ↓ OR: session present
"use client" page → AuthGate → dynamic(ssr:false) → views/Settings
                     (client-only; server never resolved identity)
```

The server *could* read cookies from Phase 1.1 onward, but no page did. Every private page was still a
client shell that learned who you were in the browser.

### After (Phase 1.2)

```
Request /settings
   ↓ proxy.ts            — request-level gate + session refresh   (layer 1)
   ↓ page.tsx            — Server Component
        hasServerAuth()? ── no ──→ <SettingsShell />  (AuthGate owns it: demo/unconfigured)
                │ yes
        getServerSession() ──→ getServerUser() ──→ auth.getUser()  (layer 2: server)
                ↓
        verified identity ──→ <SettingsShell session={{uid,email}} />  (client boundary)
                                     ↓
                             ServerSessionBridge → QueryClient cache
                                     ↓
                             views/Settings (unchanged) + AuthGate fallback
```

---

## 3. Server authentication proof

Identity is obtained in exactly one new place, and it delegates to the existing utility:

- **`src/lib/server-session.ts` → `getServerSession()`** calls **`getServerUser()`** in
  `src/lib/supabase-server.ts` (the Phase 1.1 mechanism), which builds a `createServerClient` over
  `next/headers` cookies and calls **`auth.getUser()`** — JWT verification, not a cookie read.
- `getServerSession()` returns exactly `{ uid, email, emailConfirmedAt }`. It reads **no** application
  data: no `profiles` row, no posts, no drafts.
- `src/app/settings/page.tsx` awaits it during render, before any markup exists.

No second mechanism was introduced: `getServerUser` had zero consumers before this phase and now has
exactly one, through this wrapper. Nothing reads identity from `localStorage`, the browser client, or
mock state.

**Demo/unconfigured distinction.** `hasServerAuth()` exists because "no session" has two causes. With no
cookie session to read (demo mode, unconfigured build), gating on the server would bounce users into a
login form the mock backend can never satisfy. So the server declines and `AuthGate` — which reads the
browser-local mock session — keeps ownership. That is why the page returns `<SettingsShell />` with no
session in that branch.

---

## 4. Server / client boundaries

| Unit | Kind | Responsibility |
| --- | --- | --- |
| `src/app/settings/page.tsx` | **Server Component** | Resolve + enforce identity; pass only `{uid, email}` |
| `src/app/settings/settings-shell.tsx` | Client (`"use client"`) | Owns the browser-only tree: `dynamic(ssr:false)` view, `AuthGate`, cache seed |
| `src/components/ServerSessionBridge.tsx` | Client | Seeds `["serverSession"]` in the QueryClient — no refetch |
| `src/views/Settings.tsx` | Client (**unchanged**) | The existing interactive form, byte-for-byte |
| `src/lib/server-session.ts` | Server-only | Identity resolution + `requireServerSession` redirect |

The route page has no `"use client"`. Only serialisable identity crosses the boundary — the shell's
props are `{ uid: string; email: string | null }`, never a Supabase `User` object.

**Why a cache seed rather than props.** `AuthProvider` renders `{!loading && children}`, so the app's
client render waits for the browser session. Under those conditions Next replaces the prerendered HTML
with the client-rendered tree at hydration, so authenticated *detail* in static markup cannot survive to
the interactive page. Rather than pretend otherwise, the shell passes verified identity into the shared
cache, where client code reads it without a second fetch. Once a page renders its real content on the
server (see §9), this becomes ordinary prop passing.

---

## 5. Auth layers

| Layer | Where | Responsibility |
| --- | --- | --- |
| **1. Request gate** | `src/proxy.ts` | Runs before render. Refreshes the session and writes rotated cookies; redirects anonymous requests for protected paths. Stops *most* anonymous requests before the page executes. |
| **2. Server resolution** | `page.tsx` + `server-session.ts` | The authoritative per-page check. Even if the proxy were bypassed, the page resolves identity itself and refuses to render a session-bound view without it. |
| **3. Client guard** | `AuthGate` | Kept. Handles client-side transitions (proxy sees only real requests), and is the sole protection in demo/unconfigured mode. |

**No duplicate fetching.** The proxy verifies once per request; the page resolves once; `AuthGate` reads
`AuthProvider` state and fetches nothing; the bridge seeds rather than refetches. Server and client can
each verify once because they serve different purposes — the proxy refreshes cookies (which only a
request context can write), the page decides rendering. Neither re-implements the other.

---

## 6. Files changed

**New**

| File | Why |
| --- | --- |
| `src/lib/server-session.ts` | `getServerSession`, `hasServerAuth`, `requireServerSession` — the single server-side identity entry point for route pages, delegating to `getServerUser`. |
| `src/app/settings/settings-shell.tsx` | Client boundary: `dynamic(ssr:false)` view + `AuthGate` fallback + cache seed. |
| `src/components/ServerSessionBridge.tsx` | Hands server-verified identity to client code without a second fetch. |
| `src/test/phase1.2-server-session.test.tsx` | 15 tests: server identity, anonymous → redirect, demo fallback, boundary invariants. |

**Modified**

| File | Change |
| --- | --- |
| `src/app/settings/page.tsx` | Client shell → **Server Component**. Resolves identity, marks `dynamic = "force-dynamic"`, renders `SettingsShell` with `{uid, email}`. |
| `tsconfig.legacy.json` | Excludes server-only modules and `.next/types` from the Vite rollback typecheck (see below). |

**Untouched:** `views/Settings.tsx` (UI byte-identical), all other pages, `proxy.ts`, `AuthGate`, return
path validation, `main`.

**One incidental but necessary decision.** The legacy config remaps `next/navigation` to React Router
shims for the frozen Vite snapshot, so it has no `redirect`/`cookies`. Server-only modules cannot be
typechecked under that map. `tsconfig.legacy.json` now excludes `src/app/**`, `server-session.ts`,
`supabase-server.ts`, `proxy.ts` and the server test, and omits `.next/types` from `include` (Next
generates a route validator there that imports every page). The Vite entry is `src/main.tsx` and reaches
none of this; the canonical `tsconfig.json` still typechecks all of it, which is why both typechecks are
green.

---

## 7. Validation

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | **0 errors** |
| `npx tsc -p tsconfig.legacy.json --noEmit` | **0 errors** |
| `npx eslint src` | **0 errors**, 6 pre-existing warnings (unchanged baseline) |
| `npx vitest run` | **251 passed / 251**, 23 files (+15) |
| `npm run build:next` (Turbopack) | success, `/settings` reported **`ƒ` dynamic** |
| `npm run build:next:webpack` | success, `ƒ /settings`, proxy registered |
| `npm run build:legacy` (Vite) | success |
| Smoke — **configured** | **15/15 protected → 307**, **20/20 public → 200** |
| Smoke — `/settings` anonymous | `HTTP 307`, `location: /login?from=%2Fsettings`, **23-byte body, zero private markup** |
| Smoke — `/settings` demo/unconfigured | `200`, **0 visible characters** of body text, no private strings |
| Loop check | `/settings` → `/login?from=%2Fsettings` in **1 hop**, terminating at 200 |

The 23-byte redirect body is the direct evidence that no private content is produced for an anonymous
request. The unconfigured 200 is expected — the server cannot verify a mock session, so `AuthGate` owns
it — and the zero visible characters show the shell renders empty rather than leaking the form.

---

## 8. Verification gaps

1. **No live Supabase credentials.** `auth.getUser()` was stubbed in tests and never ran against a real
   project. The *wiring* is proven; real JWT verification is not.
2. **No real browser.** The hydrated/interactive states were not observed: cookie persistence across a
   reload, a real `next/link` transition landing on `AuthGate`, and the cache seed being read by client
   code. Everything above is SSR output and HTTP status.
3. **The authenticated server render is proven structurally, not visually.** With no valid cookie, a real
   authenticated `/settings` render could not be produced end-to-end. What is proven is that the page
   resolves identity from the cookie session and passes it to the shell (tested with a stubbed
   `getServerUser`), and that anonymous requests never receive private markup (tested over HTTP).
4. **`/settings` is now `force-dynamic`.** Correct for private content, but it means this page is no
   longer statically served. That is intended and should be the rule for every future private page.

---

## 9. Recommended next phase

**Phase 2 — server-rendered private content (the real payoff).** This phase proved the identity half of
the chain. The link that remains is application data:

1. Have the server render `views/Settings`' *initial* profile data, replacing `getUserProfile(uid)` on
   mount with a server read keyed on the verified `uid` — that is where the Neon + Drizzle boundary
   eventually lands, and `getServerSession().uid` is already the right input.
2. That requires the first non-`ssr:false` private tree, which in turn means resolving the
   `AuthProvider` `{!loading && children}` gate — the single biggest remaining obstacle to server-rendering
   anything authenticated. Worth doing deliberately, on one page, before the pattern spreads.
3. Keep `?from=` / `sanitizeReturnPath` untouched: three layers now depend on it.

Until step 2, "server-rendered private page" honestly means: **identity and access are server-side; the
UI is still client-rendered.** That is the accurate description of what this phase achieved.

---

## Awaiting approval

No further work started. Changes are uncommitted on `arena/8bcaaf16-freelancer-s-hub`.
