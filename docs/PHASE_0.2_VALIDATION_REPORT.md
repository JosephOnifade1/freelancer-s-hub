# Borynx — Phase 0.2: Browser Validation & Next.js Foundation Stabilization

Date: 2026-11-12
Branch: `arena/9292938e-freelancer-s-hub` (from `migration/nextjs-app-router` @ `59008ce2`)
Base after Phase 0.1: Next.js `16.4.6`, React `19.3.1`

---

## 1. Browser validation status — read this first

**No real browser was available in this environment.** I did not fake it. Here is
exactly what was and was not executed:

| Category | Status | Detail |
| --- | --- | --- |
| **Real browser (Chrome/Firefox/WebKit)** | ❌ **NOT PERFORMED** | No browser binary and no way to obtain one: the only reachable hosts are `github.com`, `registry.npmjs.org`, `pypi.org`; the Chrome-for-Testing CDN, Playwright CDN and `deb.debian.org` all time out (verified with curl), and `apt-get` requires root (uid 1001). |
| **Automated server/document checks** | ✅ Executed | `scripts/server-smoke.mjs` — 44 assertions over 36 routes against both `next start` and `next dev`. |
| **Hydration / component-level (jsdom)** | ✅ Executed | `src/test/phase02-interaction.test.tsx` (24 tests) + `src/test/next16-compat.test.tsx` (5) — real components, real providers, real adapter, React 19 dev build, console captured. |
| **SSR verification** | ✅ Executed | `renderToString` of the real views in `next16-compat.test.tsx`; prerendered App Router output inspected on the server. |
| **Manual verification** | ⏳ **REQUIRED** | See the checklist in §8. Anything about pixels, fonts, motion, paint, real history navigation and clipboard/permission prompts needs a human. |

What jsdom **cannot** prove: layout/paint correctness, font loading, CSS that is
present but visually wrong, Framer Motion timings, `position: sticky` behaviour,
real `history.pushState` + back/forward across App Router segments, file pickers,
clipboard, and true hydration diffing of React's client render against the
server HTML.

---

## 2. Issues found and fixed

### 2.1 `process.env` read through a computed key — Supabase config never reached the browser (HIGH)

* **Symptom (verified in the compiled bundle, not theorised):** with
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_DEMO_MODE` set, the bundled client code
  contained only the *string* `"NEXT_PUBLIC_SUPABASE_URL"` used as a lookup key —
  the value was never inlined, so `isDemoMode` was always `false` and every build
  fell back to the placeholder client with "Supabase is not configured".
* **Root cause:** `src/lib/supabase.ts` resolved variables via
  `getEnv("VITE_X", "NEXT_PUBLIC_X")` → `process.env[nextKey]`. Next/Turbopack
  inlines **literal** member expressions only. Proven with a minimal repro
  (`/tmp/envtest`): `process.env.NEXT_PUBLIC_PROBE` → `"INLINED_VALUE"`, whereas
  `process.env[key]` stays dynamic (and webpack rewrites the bare object to
  `{}`).
* **Fix:** every variable is now read with a literal identifier. Each supported
  variable is listed explicitly; nothing is read through a computed key.
* **Files:** `src/lib/supabase.ts`, `.env.example`, `src/test/phase02-env.test.ts`
  (new regression test that fails if a computed `process.env[...]` read returns).
* **Verified after fix:** `next build --turbopack` emits the demo-mode value and
  the Supabase URL/anon key into the client chunk; the Vite build still resolves
  through `import.meta.env` (checked with `VITE_DEMO_MODE=true` under Vitest).

### 2.2 Sidebar active state rendered a function into the DOM (MEDIUM)

* **Symptom:** sidebar links had
  `class="... ({ isActive }) => __vite_ssr_import_8__.cn(...)"` — the active
  style never applied, and a raw function source leaked into the markup.
* **Root cause:** `SidebarMenuButton` was used with `asChild`, so Radix `<Slot>`
  merged its own `className` into the child's props; the child was a `NavLink`
  whose `className` was a **render prop**. Slot stringifies it.
* **Fix:** `AppSidebar` no longer passes `asChild` for the link case (documented
  inline); `src/components/NavLink.tsx` now always hands React Router a string.
* **Files:** `src/components/AppSidebar.tsx`, `src/components/NavLink.tsx`.
* **Verified:** test asserts no anchor class matches `/isActive|=>/` and that the
  current route's link carries `bg-brand`.

### 2.3 `Link`/`Navigate` dropped React Router `state` (MEDIUM)

* **Symptom:** under Next, `location.state` was hardcoded `null`, so
  `postAuthRedirect()` always returned `/` — after signing in from
  `/login?from=/l/post` the user landed on the home page instead of where they
  were bounced from.
* **Root cause:** the adapter accepted `state` and discarded it.
* **Fix:** the adapter now bridges state through `history.state`
  (`__borynx_nav_state`) on `Link` click, `Navigate`, and
  `navigate(..., { state })`, and `useLocation()` reads it back. No storage, no
  cookies, no auth-architecture change.
* **Files:** `src/lib/navigation.tsx`.
* **Verified:** tests cover Link→state, the ProtectedRoute `{ from: location }`
  shape → `/pipeline?tab=1`, `useNavigate` push/replace/back mapping, and
  `setSearchParams` building `/current?feed=following`.

### 2.4 Redirect-only URLs 404'd under Next (MEDIUM)

* **Symptom:** `/b`, `/p`, `/f`, `/u`, `/following` redirect client-side in
  `src/App.tsx`. Under Next they returned the 404 page.
* **Fix:** five thin App Router pages using `src/lib/redirect-to.tsx`
  (`router.replace`), mirroring `App.tsx` exactly.
* **Files:** `src/app/{b,p,f,u,following}/page.tsx`, `src/lib/redirect-to.tsx`.
* **Verified:** server smoke (HTTP 200 on all five) + a test asserting each alias
  calls `replace` with the destination declared in `App.tsx`.

### 2.5 Webpack escape hatch warned on `import.meta` (LOW)

* **Symptom:** `next build --webpack` printed "Critical dependency: Accessing
  import.meta directly is unsupported".
* **Fix:** the Vite env object is read once at module scope (Vite replaces it
  statically; Next leaves a harmless `undefined` property access).
* **Verified:** `next build --webpack` now compiles with no warnings, and env
  values are still inlined there (checked in `/.next/static/chunks/app/*.js`).

### 2.6 `Link` lost its `export` keyword (found by tsc during this phase)

The Phase 0.1 adapter edit left `const Link = forwardRef(...)` without `export`.
TypeScript caught it; restored. This is exactly why the type check is part of the
gate.

### Non-issues checked and cleared

* `dynamic(..., { ssr: false })` on all 31 original routes → **justified** (§4).
* No hydration-markup mismatch: every route prerenders a spinner and hydrates the
  same spinner; `suppressHydrationWarning` on `<html>` covers `next-themes`.
* No duplicate element ids in served HTML; no `next/image` usage; no
  `next/legacy/image`; no `middleware`; no async request APIs used.
* Vite bundle: the rewritten `process.env` (`gh={}; gh.NEXT_PUBLIC_…`) resolves
  to `undefined`, and the Vite branch (`import.meta.env`) takes over — confirmed
  by running with `VITE_DEMO_MODE=true`, which flips `isDemoMode` to `true`.

---

## 3. React Router dependency inventory

### 3.1 Adapter surface (`src/lib/navigation.tsx`)

| React Router API | Adapter implementation | Notes |
| --- | --- | --- |
| `Link` | `next/link`, resolves `to`/`href`/object form | now carries `state` + user `onClick` |
| `NavLink` | `next/link` + `usePathname()` | `className` may be string or render prop; supports `activeClassName`/`pendingClassName` |
| `useNavigate` | `next/navigation` `useRouter` | number arg → `back()`/`forward()`; `replace` honoured |
| `useLocation` | `usePathname` + `useSearchParams` + history state | returns `{ pathname, search, hash:"", state, key }`; `search` is `""` or `"?…"` |
| `useParams` | `next/navigation` `useParams` | returned correctly (tested with `{ id: 42 }`) |
| `useSearchParams` | `useSearchParams` + `router.push/replace` | `searchParams` object + RR-compatible setter |
| `Navigate` | effect → `router.replace/push` | renders `null`; writes `state` first |
| `MemoryRouter`/`Routes`/`Route`/`BrowserRouter` | passthrough / no-op | test-only stubs; `App.tsx` (Vite) uses the real ones |

### 3.2 Components importing `react-router-dom` directly (48 files)

Under the Next build these all resolve to the adapter via
`turbopack.resolveAlias` / `webpack.resolve.alias`. Under Vite they use the real
package.

**Views (23):** `Achievements`, `Admin`, `Applications`, `Communities`,
`CommunityDetail`, `CreateLead`, `CreatePost`, `Drafts`, `ForgotPassword`,
`Index`, `Landing`, `LeadDetail`, `Leaderboard`, `LeadsBoard`, `Login`,
`MyReports`, `NotFound`, `Notifications`, `Onboarding`, `Pipeline`, `PostDetail`,
`Profile`, `ResetPassword`, `Signup`, `TagFeed`, `UserMeRedirect`.

**Components (15):** `AppLayout`, `AppSidebar`, `Breadcrumbs`, `ComingSoon`,
`CommunityHoverCard`, `ComposerBar`, `FeedSidebar`, `LeadCard`, `LegalPage`,
`NavLink`, `NotificationBell`, `PollWidget`, `PostCard`, `ProtectedRoute`,
`UserHoverCard`, `modals/CreateCommunityModal`.

**Vite app shell:** `src/App.tsx` (never imported by Next).

**Tests (3):** `NotificationBell.test.tsx`, `CreatePost.test.tsx`,
`PostDetail.test.tsx` (use real `MemoryRouter` — Vitest does not alias).

### 3.3 Naming collision to note

`src/components/NavLink.tsx` is a **different component** from the `NavLink` the
adapter exports: it wraps whichever `NavLink` `react-router-dom` resolves to and
adds `activeClassName`. It now always passes a string `className`.

### 3.4 Recommended future migration order

Ordered by blast radius, each step shippable on its own:

1. **Leaf links with no state/hooks** — `LegalPage`, `ComingSoon`,
   `CommunityHoverCard`, `UserHoverCard`, `LeadCard`, `PostCard` (replace `Link`
   with `next/link`; delete the import).
2. **Read-only views** — `Privacy`, `Terms`, `Leaderboard`, `Popular`,
   `NewFeed`, `Communities`, `TagFeed`, `Achievements`, `Drafts`, `MyReports`,
   `Notifications`.
3. **`useLocation` consumers** — `Breadcrumbs`, `AppSidebar`, `PollWidget`,
   `NotFound`, `Login`, `Signup` (swap `usePathname()`/`useSearchParams()`
   directly; keep `state` usage last).
4. **Navigation writers** — `LeadsBoard`, `CreatePost`, `CreateLead`, `Profile`,
   `Onboarding`, `CommunityDetail`, `PostDetail`, `LeadDetail`, `Pipeline`,
   `Applications`, `Admin` (replace `useNavigate` with `useRouter`).
5. **`ProtectedRoute` + redirects** — replace with App Router layouts /
   `redirect()` once the auth phase lands. This is the only remaining consumer of
   `Navigate` + `state`.
6. **Delete** `src/lib/navigation.tsx`, then drop `turbopack.resolveAlias` and the
   `webpack` alias from `next.config.mjs` in the same commit.
7. **Retire `src/App.tsx`** and the Vite build only after every view is
   adapter-free and the App Router owns all 36 URLs.

Do **not** start at step 5 — auth changes are out of scope for this phase.

---

## 4. Client/server boundary findings

All 36 App Router pages are one-line client shells. `dynamic(..., { ssr: false })`
is used on 31 of them (the 5 redirect aliases are client components with no
dynamic import).

**Why each family genuinely needs the client today:**

| Group | Evidence |
| --- | --- |
| Feed / posts / profile (`/`, `/new`, `/popular`, `/p/[id]`, `/b/[slug]`, `/f/[handle]`, `/tag/[tagName]`) | Supabase session (`useAuth`), TanStack Query, Framer Motion, `PostCard` clipboard (`navigator.clipboard`), `localStorage` draft fallback |
| Composer (`/submit`) | TipTap/ProseMirror (DOM-only), `localStorage` drafts, image upload |
| Auth (`/login`, `/signup`, `/forgot-password`, `/reset-password`) | `window.location.origin` for OAuth redirect, Supabase auth events, `localStorage` recovery marker |
| Leads / pipeline / applications (`/l`, `/l/post`, `/l/[leadId]`, `/pipeline`, `/applications`) | `localStorage` lead drafts, Supabase RLS-scoped queries |
| Account (`/settings`, `/notifications`, `/bookmarks`, `/achievements`, `/my-reports`, `/drafts`, `/admin`, `/onboarding`) | session-scoped queries, `window.innerWidth` (AppLayout), Radix overlays |
| Static content (`/privacy`, `/terms`, `/leaderboard`) | wrap `AppLayout`, which measures the viewport and reads the session |

**Could eventually become Server Components (no action taken):** the static copy
in `/privacy` and `/terms` (inner `LegalPage` content), the `/forgot-password`
form shell, and the `/leaderboard` heading. Each requires first extracting the
presentational part out of the `AppLayout` client boundary — a design-affecting
change, so deliberately deferred.

**Unnecessarily wrapped?** None found: every view reads the session or browser
storage at render time. The only reducible wrapper is the App Router shell itself
once views become hybrid.

**Browser-only dependencies:** `framer-motion` (all feed/landing views), `@tiptap/*`
(composer + editor preview), `sonner` (toasts), Radix portals (dialogs,
dropdowns, tooltips), `canvas-confetti` (veteran celebration), `dompurify` /
`marked` (markdown, client-side).

**Server-incompatible code:** none — the one browser API touched during render is
guarded (`hasMockRecovery()` has try/catch, `ResetPassword` calls it inside
`useEffect`), and SSR renders of `Landing`, `LeadsBoard` and `Login` pass.

---

## 5. Configuration findings

| Setting | Where | Verdict |
| --- | --- | --- |
| `reactStrictMode: true` | `next.config.mjs` | **Long-term.** Keep. |
| `transpilePackages: ["lucide-react"]` | `next.config.mjs` | **Long-term.** Keep until lucide ships ESM that Next resolves natively. |
| `images.remotePatterns` | `next.config.mjs` | **Long-term.** App uses `<img>`, but the allowlist documents the trusted image hosts (Supabase/unsplash/dicebear/vercel) for any future `next/image` adoption. No behavioural effect today. |
| `allowedDevOrigins` | `next.config.mjs` | **Long-term.** Required to serve `next dev` behind the preview proxy / LAN hosts. |
| `turbopack.resolveAlias["react-router-dom"]` | `next.config.mjs` | **Migration-only.** Remove in step 6 of §3.4. |
| `webpack()` alias | `next.config.mjs` | **Migration-only**, and it is also the rollback path (`build:next:webpack`). Remove with the adapter. Keep `webpack` itself out of config only when nobody needs the escape hatch. |
| `data-scroll-behavior="smooth"` | `src/app/layout.tsx` | **Long-term.** Next 16 stopped overriding `scroll-behavior`; this restores pre-16 instant scroll on navigation. |
| `jsx: "react-jsx"`, `.next/dev/types` include | `tsconfig.json` | **Long-term.** Mandatory for Next 16. |
| `strict: false`, `strictNullChecks: false` | `tsconfig.json` | **Technical debt, not migration-related.** Relaxed from the Vite app. Turning strict on is a separate, app-wide task. |
| `ssr: false` on every route shell | `src/app/**/page.tsx` | **Migration-only** (§4). |
| Scripts: `dev:next`, `dev:next:webpack`, `build:next`, `build:next:webpack`, `typecheck`, `lint` | `package.json` | **Long-term** (the webpack variants can go once Turbopack is trusted for rollback). |
| `eslint.config.js` ignores `.next`, `dist`, `coverage` | `eslint.config.js` | **Long-term.** |

Nothing was removed: the app has not been validated without any setting above.

---

## 6. Validation results (all executed on this branch)

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit -p tsconfig.json` | **PASS**, 0 errors |
| ESLint | `npx eslint .` | **PASS**, 0 errors, 6 pre-existing fast-refresh warnings |
| Vitest | `npx vitest run` | **PASS — 12 files, 78/78 tests** (was 49; +24 interaction/parity/env, +5 prior compat) |
| Next build (Turbopack) | `npm run build:next` | **PASS** — 32/32 static pages, 36 routes |
| Next build (webpack) | `npm run build:next:webpack` | **PASS** — no warnings |
| Vite build | `npm run build` | **PASS** |
| Server/document smoke | `node scripts/server-smoke.mjs` | **PASS — 44/44** against `next start` **and** `next dev` |
| Route checks | 36 routes | all 200; unknown path 404; every referenced JS/CSS asset 200 |
| Preview-host check | `Host: 3000-xyz.e2b.app` | 200 |
| Console errors | React 19 dev build, jsdom | 0 React/Next errors during mounts, interactions and hydration probes |
| Real browser | — | **NOT PERFORMED** (see §1) |

Re-runnable numbers: 78 tests, 44 server assertions, 36 routes, 6 lint warnings,
0 lint errors, 0 type errors.

---

## 7. What changed in this phase

**Fixed:** `src/lib/supabase.ts` (env inlining + webpack-safe `import.meta`),
`src/lib/navigation.tsx` (state bridge, restored `Link` export),
`src/components/AppSidebar.tsx` (Slot/`asChild` fix), `src/components/NavLink.tsx`
(string className), `.env.example` (both conventions documented).

**Added:** 5 redirect pages (`b`, `p`, `f`, `u`, `following`),
`src/lib/redirect-to.tsx`, `src/lib/route-parity.ts`,
`scripts/server-smoke.mjs`, `src/test/phase02-interaction.test.tsx`,
`src/test/phase02-env.test.ts`, this report.

**Untouched:** every page design, colour token, `tailwind.config.ts`,
`src/index.css`, `public/`, Supabase schema and migrations, mock database, auth
architecture, `src/App.tsx`, `main.tsx`, `vite.config.ts`, and all pre-existing
tests.

---

## 8. Human verification checklist (preview URL)

1. Home loads as the **landing page** while signed out; dark palette, Inter/Space
   Grotesk fonts visible (no fallback serif), logo + favicon present.
2. Sidebar: click each item — Home, Popular, Spaces, Opportunities — the **active
   item is highlighted in brand blue** (this is the §2.2 fix).
3. Collapse the sidebar (toggle button); layout reflows without jump.
4. Browser **back/forward** across 2–3 routes returns to the right page and
   scroll position.
5. Sign-in redirect: open `/l/post` signed out → bounced to `/login` → sign in →
   should return to the intended page (**§2.3 fix**).
6. Theme switcher (avatar menu → theme): light/dark/system applies instantly with
   no flash on reload; toast styling matches the theme.
7. Open a dropdown, a dialog and a tooltip: shadow, border radius and brand ring
   match the pre-migration screenshots; Escape closes and focus returns.
8. Trigger a toast (e.g. copy a post link) — appears top-right, auto-dismisses.
9. Feed: vote up/down; the control animates and the count updates.
10. Landing page Framer Motion: hero sections animate in; no layout shift.
11. `/b`, `/p`, `/f`, `/u`, `/following` redirect instead of 404.
12. Open `/submit`: the TipTap editor types, toolbar buttons work, images/Ctrl+V
    paste, and the markdown preview renders.
13. Console (DevTools) on every route above: **no** red errors, no
    "Hydration failed" / "did not match" warnings.
14. Mobile width (≤ 768 px): hamburger opens the sheet, search opens, nothing
    overflows horizontally.
15. With `NEXT_PUBLIC_DEMO_MODE=true`: seeded posts appear (**this proves §2.1**);
    with real `NEXT_PUBLIC_SUPABASE_*` credentials, data loads and the console
    shows no "not configured" error.

---

## 9. Recommended next phase

**Phase 0.3 — Adapter reduction, step 1–2 of §3.4.** Replace the adapter in leaf
components and read-only views (`Link` → `next/link`, `useLocation` →
`usePathname`/`useSearchParams`), one small PR per group, with the route-parity
and interaction tests as the safety net. Keep `ProtectedRoute`, `Navigate` and the
`state` bridge until the auth phase.

Deliberately **not** started: authentication migration, Neon/Drizzle, R2, UI
redesign, strict-mode TypeScript, Vite removal, Next 16.5/canary adoption.

**Awaiting approval.**
