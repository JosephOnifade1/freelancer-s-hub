# Borynx — Phase 0.3: React Router Adapter Reduction

**Branch:** `arena/3db50d09-freelancer-s-hub` → target `migration/nextjs-app-router`
**Base:** `af87cb4` (Phase 0.2 merge)
**Date:** 12 November 2026
**Scope:** migration steps 1 (leaf components) and 2 (read-only views) only

---

## 1. Summary

Phase 0.3 moved **15 production files** off the React Router compatibility layer and onto native Next.js navigation — the 8 leaf components and 7 read-only/low-risk views identified below. Direct `react-router-dom` consumers in production code dropped from **45 to 32**. No URL changed, no route was added or removed, no authentication or protected-route code was touched, and the compatibility layer (`src/lib/navigation.tsx`) and `react-router-dom` dependency remain in place for the 30 files that still need them.

**The central constraint of this phase was not stated in the brief and had to be discovered:** Borynx ships **two apps from one source tree**. Every view and component is imported by both the Next.js App Router pages *and* the Vite app (`src/App.tsx`). Only `src/app/**` is Next-only. A file that adopts `next/link` is therefore consumed by the Vite build too, and **`next/link` degrades silently there**: it renders a plain anchor, and its click handler bails out when no App Router context exists (`if (!router) { return; }` in `next/link`'s source), so every click becomes a **full page reload** instead of React Router's client-side navigation.

That was measured, not assumed (§6, issue 3). The fix is a dual-runtime link (`src/components/AppLink.tsx`) that renders `next/link` inside the App Router and React Router's `Link` under Vite/Vitest. The same discriminator (`usePathname() !== null`) drives the pathname seam used for active state.

---

## 2. Files migrated

### Step 1 — leaf components (8)

| File | Previous | New | Client Component? | Why client |
|---|---|---|---|---|
| `src/components/LegalPage.tsx` | `Link` from `react-router-dom` | `AppLink` (native `href`) | No new directive | Already reachable from client mount |
| `src/components/LeadCard.tsx` | `Link` | `AppLink` | No new directive | — |
| `src/components/UserHoverCard.tsx` | `Link` | `AppLink` | No new directive | Already `useQuery` + `useState` |
| `src/components/CommunityHoverCard.tsx` | `Link` | `AppLink` | No new directive | Already `useQuery` |
| `src/components/FeedSidebar.tsx` | `Link` | `AppLink` | No new directive | Already `useQuery`/`useMemo` |
| `src/components/PostCard.tsx` | `Link` (9 sites) | `AppLink` | No new directive | Already has handlers/queries |
| `src/components/Breadcrumbs.tsx` | `Link` + `useLocation` | `AppLink` + `useCurrentPathname()` | No new directive | Pathname only |
| `src/components/NavLink.tsx` | delegated to adapter `NavLink` | native `AppLink` + `useCurrentPathname()`, active computed locally | **`"use client"` added** | Hooks: `usePathname`/`useLocation`, `forwardRef` |

### Step 2 — read-only views (7)

| File | Previous | New | Client Component? | Notes |
|---|---|---|---|---|
| `src/views/Landing.tsx` | `Link` (13 sites) | `AppLink` | No new directive | Public marketing page; already `useState` |
| `src/views/Leaderboard.tsx` | `Link` (2) | `AppLink` | No new directive | Read-only ranking |
| `src/views/Admin.tsx` | `Link` (3) | `AppLink` | No new directive | Read-only link surface (tabs unchanged) |
| `src/views/Applications.tsx` | `Link` (4) | `AppLink` | No new directive | Read-only list |
| `src/views/Achievements.tsx` | `Link` (1) | `AppLink` | No new directive | Read-only badges |
| `src/views/Pipeline.tsx` | `Link` (2) | `AppLink` | No new directive | Read-only board |
| `src/components/AppSidebar.tsx` | `useLocation` from adapter | `useCurrentPathname()` + native `NavLink` | No new directive | Active state now computed natively |

Supporting files added (not migrations — infrastructure the above depends on):

| File | Purpose |
|---|---|
| `src/components/AppLink.tsx` | Dual-runtime link: `next/link` in Next, React Router `Link` in Vite/Vitest |
| `src/hooks/useCurrentPathname.ts` | Dual-runtime pathname: `usePathname()` in Next, `useLocation()` in Vite/Vitest |
| `src/lib/nav-link-active.ts` | Active-state rule (segment-boundary matching) |

**Duplication note:** steps 1 and 2 use the identical transformation — `Link` → `AppLink`, `to=` → `href=`. They are reported separately as the brief requires, but the technical risk was the same and was validated once.

---

## 3. Remaining React Router dependencies

### Direct `react-router-dom` imports in production code — **32 files** (was 45)

| Group | Count | Files |
|---|---|---|
| View-level `useLocation` / `useParams` / `useHistory` consumers (step 3 of the order) | 14 | `CommunityDetail`, `Communities`, `LeadDetail`, `PostDetail`, `Profile`, `TagFeed`, `NotFound`, `LeadsBoard`, `Index`, … |
| Navigation *writers* (`useNavigate`) (step 4) | 9 | `CreateLead`, `CreatePost`, `Drafts`, `MyReports`, `Notifications`, `Onboarding`, `UserMeRedirect`, `ForgotPassword`, `ResetPassword` |
| Auth / protected route (step 5, **intentionally untouched**) | 3 | `components/ProtectedRoute.tsx`, `views/Login.tsx`, `views/Signup.tsx` |
| Adapter + seams + Vite shell + config | 6 | `lib/navigation.tsx`, `lib/route-parity.ts` (doc comment only), `components/AppLink.tsx`, `components/ComingSoon.tsx`, `components/ComposerBar.tsx`, `components/NotificationBell.tsx`, `components/AppLayout.tsx`, `views/Communities.tsx` |

`views/Communities.tsx` is deliberately retained: it passes React Router **`state`** (`state={{ from: { pathname } }}`), which has no native equivalent — that is the `history.state` bridge owned by the auth phase.

### Files importing the compatibility adapter (`@/lib/navigation`)

**2** — `src/test/next16-compat.test.tsx`, `src/test/phase02-interaction.test.tsx`. Tests import the adapter deliberately to exercise it. In the Next build the specifier `react-router-dom` **is** the adapter (see `next.config.mjs`), so all 30 un-migrated production files reach the adapter through that alias.

### Test files still importing `react-router-dom` — 6

`NotificationBell.test.tsx`, `CreatePost.test.tsx`, `PostDetail.test.tsx`, `next16-compat.test.tsx`, `phase02-interaction.test.tsx`, `phase03-navigation.test.tsx`. These need `MemoryRouter`, which the adapter stubs but which the real package provides faithfully.

### Adapter API usage (what the un-migrated files still need)

`Link` ×20, `useNavigate` ×19, `useLocation` ×10, `useParams` ×6, `Navigate` ×5, `useSearchParams` ×2, `BrowserRouter`/`Routes`/`Route` ×3 (Vite shell only).

**No adapter API was removed.** Every export is still consumed.

---

## 4. Client/Server boundaries

**No new `"use client"` directive was added to any view or page.** All 36 route shells were already client-only (`dynamic(..., { ssr: false })`), so this phase did not widen the client boundary at the page level.

Two files carry `"use client"`, both newly added and both genuinely client-only:

- `src/components/AppLink.tsx` — reads `usePathname()` (a client hook) to choose its renderer. Every consumer is already client-mounted, and all views mount with `ssr: false`, so no server render can diverge.
- `src/hooks/useCurrentPathname.ts` — calls `usePathname()` + `useLocation()`.

`src/components/NavLink.tsx` gained `"use client"` (it previously had none because it imported no Next hooks). It uses `usePathname`, `forwardRef` and event handlers — legitimately client.

**No server-incompatible code was introduced.** `AppLink`'s runtime choice happens during client render only.

**Still blocked on Server Components:** `/privacy`, `/terms` and the `/leaderboard` heading remain behind the client `AppLayout` boundary. Making them server-rendered requires extracting presentational markup out of `AppLayout` — a larger change than steps 1–2, deliberately deferred.

---

## 5. Validation results

Every item below was executed on the final tree.

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **Pass**, 0 errors |
| ESLint | `npx eslint .` | **0 errors**, 6 warnings — all pre-existing (`react-refresh/only-export-components` in `app/layout.tsx` ×2, `lib/navigation.tsx` ×4) |
| Vitest | `npx vitest run` | **97/97 pass, 13 files** (was 78/78, 12 files; +19 new) |
| Next.js Turbopack build | `npm run build:next` | **Compiled successfully**, 32/32 static pages |
| Next.js webpack build | `npm run build:next:webpack` | **Compiled successfully**, 32/32 static pages, no warnings |
| Vite build | `npm run build` | **built in ~11s**, no errors (pre-existing >500 kB chunk advisory only) |
| Route smoke — `next start` (Turbopack) | `SMOKE_BASE_URL=… node scripts/server-smoke.mjs` | **44/44 pass** |
| Route smoke — `next start` (webpack) | same | **44/44 pass** |
| Route smoke — `next dev` (Turbopack, port 3000) | same | **44/44 pass** |
| Vite rollback preview | `vite preview` | `/`, `/leaderboard`, `/privacy`, `/terms`, `/communities`, `/l`, `/b/developers` all **200** |
| Preview host | `Host: 3000-abc.e2b.app` | **200** |

The smoke suite covers all 36 routes (31 real + 5 aliases), 404 behaviour for unknown paths, asset references, design tokens and theme classes in the served stylesheet, and duplicate-element-id checks.

**Browser validation status: NO REAL BROWSER WAS AVAILABLE.** This is unchanged from Phase 0.2 — Playwright/Puppeteer and Chrome-for-Testing CDNs are unreachable from this environment, and `apt-get` requires root. Everything above is **automated, jsdom-level, or HTTP/SSR-level** verification. Nothing here confirms pixels, fonts, motion timing, or navigation *between route segments* in a real browser. §8 lists what a human must still confirm.

Two new automated replacements for browser checks worth noting: SPA-navigation behaviour is proven in jsdom by asserting React Router's location actually advances after a click (§6, issue 3), and active-state styling is asserted against the real rendered `class` string.

---

## 6. Issues found and fixed

### Issue 1 — `next/link` breaks client-side navigation in the Vite build (HIGH, introduced then fixed in this phase)

- **Description:** After the first pass migrated 12 files to `next/link`, the Vite rollback build still served every page, but links no longer navigated client-side.
- **Root cause:** `next/link`'s click handler returns early when no App Router context is present (`if (!router) { return; }`), so the browser performs a default full-page navigation. Proven in jsdom: after clicking a migrated link under `MemoryRouter`, the location was still `/` and the console reported *"Not implemented: navigation (except hash changes)"*.
- **Fix:** introduced `src/components/AppLink.tsx`, which renders `next/link` when `usePathname() !== null` and React Router's `Link` otherwise. Re-verified: the location now advances to `/communities` with no reload warning.

### Issue 2 — sidebar/breadcrumb active state lost outside the App Router (HIGH, regression caught by an existing test)

- **Description:** The Phase 0.2 test *"marks the current route active in the sidebar"* failed after the first `NavLink` replacement.
- **Root cause:** `usePathname()` returns **`null`** — not a throw — outside the Next router. Active state silently evaluated to false in the Vite/Vitest runtime. The old implementation got active state from React Router's `NavLink` via the adapter, so it worked in both runtimes; the naive replacement dropped that.
- **Fix:** `src/hooks/useCurrentPathname.ts` resolves `usePathname() || useLocation().pathname || "/"`, used by `NavLink`, `AppSidebar` and `Breadcrumbs`.
- **Test change:** `src/test/phase02-interaction.test.tsx` mocked `next/navigation` with a **constant** `usePathname: () => "/current"`, which masked the new source of truth and also leaked into a later test. The mock is now variable-backed, set per test, and reset in `beforeEach`.

### Issue 3 — sidebar link could activate on a partial segment (MEDIUM, pre-existing)

- **Description:** the adapter's active rule is a bare `pathname.startsWith(target)`, so `/new` would light up on `/newsletter` and `/l` on `/legal`. Found by the new tests.
- **Fix:** `src/lib/nav-link-active.ts` requires a segment boundary (`target + "/"`); `/` matches only exactly. Applied to both `NavLink` and `AppSidebar`.

### Issue 4 — `server-smoke.mjs` only understood Turbopack's CSS path (LOW, harness bug)

- **Description:** the smoke suite crashed with `Cannot read properties of null` against a webpack build.
- **Root cause:** the regex hard-coded `/_next/static/chunks/*.css`; webpack emits `/_next/static/css/*.css`.
- **Fix:** resolve whichever stylesheet the document actually references, and fail loudly if none is found. Both bundlers now pass 44/44.

### Issue 5 — `useRouter()` throws outside Next; avoided rather than patched (design decision)

- **Description:** `views/UserMeRedirect.tsx` looked like a clean step-2 candidate (only `useNavigate`).
- **Finding:** `next/navigation`'s `useRouter()` **throws** without an App Router context, and guarding it with `try/catch` is a genuine `react-hooks/rules-of-hooks` violation (ESLint flagged it). Suppressing that error would have hidden a real hook-order hazard.
- **Decision:** reverted that migration and deleted the half-built hook. Imperative navigation belongs to **step 4 (navigation writers)** of the migration order, where `useRouter` can be used directly. No lint suppression was added.

---

## 7. Recommended next step

**Phase 0.4 — migration step 3: `useLocation`/`useParams` view consumers.** 14 views, still `Link`-heavy and read-only in routing terms. `useParams()` can be replaced directly (`next/navigation` exposes it and it returns `null` rather than throwing outside Next), while `useLocation` consumers should adopt `useCurrentPathname`.

Then step 4 (navigation writers, 9 views) becomes possible — that is where the currently-deleted `useCurrentNavigate`-style seam belongs, using `useRouter()` directly.

Keep `ProtectedRoute`, `Login`, `Signup`, `Navigate` and the `state` bridge untouched until the authentication phase. Do not delete `src/lib/navigation.tsx` or drop `react-router-dom` until step 6, and only after the Vite build is retired.

**Do not proceed automatically — awaiting approval.**

---

## 8. Human verification checklist

The environment had no real browser, so these remain unverified:

1. Click a card title on `/` (PostCard) — navigates to the post **without a full page reload**.
2. `/leaderboard` — click a member row; the leaderboard keeps its scroll position (proves client-side nav).
3. `/privacy` and `/terms` — nav links work; `landing-theme` colours and fonts unchanged.
4. Sidebar: on `/l`, "Opportunities" is highlighted (`bg-brand/10 text-brand`); on `/communities`, "Spaces" is.
5. Sidebar: open `/newsletter` (or any unknown `/new…` path) — "New posts" must **not** highlight.
6. Breadcrumbs on `/b/developers/p/abc` — "Borynx" and "Space developers" are real links; the last crumb is plain text.
7. Browser console on a few pages — no hydration mismatch warnings, no React errors.
8. Back/forward after the clicks above returns to the expected pages.
9. `/does-not-exist` still renders the in-app 404 view.
10. Mobile viewport: sidebar sheet opens, links navigate, active state correct.
11. `npm run dev` (Vite, port 8080) — the rollback app still navigates client-side on `/`, `/leaderboard`, `/privacy`.
12. Deep-load `http://<preview>/leaderboard` directly — renders, no flash of wrong theme.
