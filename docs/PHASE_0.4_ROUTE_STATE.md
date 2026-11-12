# Borynx — Phase 0.4: Route State Migration & Next.js Primary Runtime Strategy

**Branch:** `arena/07f7df87-freelancer-s-hub` → target `migration/nextjs-app-router`
**Base:** `a727bbb` (Phase 0.3 merge)
**Date:** 12 November 2026
**Scope:** migration step 3 only (`useParams` / `useLocation` / `useSearchParams` consumers). Navigation writers are inventoried, **not migrated**.

---

## 1. Route-state inventory

Sixteen production files matched the `useLocation` / `useParams` / `useSearchParams` search. Every one was classified before any edit.

Legend — **Next?** = reachable from `src/app/**`; **Vite?** = reachable from `src/App.tsx`; **Strategy** = A Next-only, B shared seam, C extraction, **R** retained.

| File | Previous API | Next? | Vite? | Needs pathname | Needs params | Needs query | RR state | Strategy | Result |
|---|---|---|---|---|---|---|---|---|---|
| `views/TagFeed.tsx` | `useParams`, (`useNavigate`) | yes | yes | no | `tagName` | no | no | **B** | ✅ params migrated |
| `views/CommunityDetail.tsx` | `useParams`, `useLocation`, `useNavigate`, `Link` | yes | yes | no | `slug` | no | yes (`state={{from: location}}`) | **B** (params) | ✅ params migrated; location + writer retained |
| `views/LeadDetail.tsx` | `useParams`, `useLocation`, `Link` | yes | yes | no | `leadId` | no | yes | **B** (params) | ✅ params migrated; location retained |
| `views/PostDetail.tsx` | `useParams`, `useNavigate`, `Link` | yes | yes | no | `id` | no | no | **B** (params) | ✅ params migrated; writer retained |
| `views/NotFound.tsx` | `useLocation`, `useNavigate`, `Link` | yes | yes | **yes** | no | no | no | **B** | ✅ pathname migrated; writer retained |
| `views/Index.tsx` | `useSearchParams`, `useNavigate`, `Link` | yes | yes | no | no | **yes** (read + write `?feed=`) | no | R | ❌ retained — see §5.2 |
| `views/CreatePost.tsx` | `useSearchParams`, `useNavigate`, `Link` | yes | yes | no | no | **yes** (read `?type=`, `?space=`) | no | R | ❌ retained — see §5.2 |
| `views/Profile.tsx` | `useParams`, `useLocation`, `Link` | yes | yes | no | `uid`/`username`/`handle` | no | **yes** | R | ❌ retained — see §5.3 |
| `views/LeadsBoard.tsx` | `useLocation`, `Link` | yes | yes | no | no | no | **yes** | R | ❌ retained — location only feeds `state` |
| `components/PollWidget.tsx` | `useLocation`, `Link` | yes | yes | no | no | no | **yes** | R | ❌ retained — location only feeds `state` |
| `views/Login.tsx` | `useLocation`, `useNavigate`, `Navigate`, `Link` | yes | yes | no | no | no | **yes** | R | ⛔ **auth — do not touch** |
| `views/Signup.tsx` | `useLocation`, `useNavigate`, `Navigate`, `Link` | yes | yes | no | no | no | **yes** | R | ⛔ **auth — do not touch** |
| `components/ProtectedRoute.tsx` | `useLocation`, `Navigate` | yes | yes | yes | no | no | **yes** | R | ⛔ **auth — do not touch** |
| `App.tsx` | `useParams` (legacy `/u/:username` redirect) | no | yes | no | `username` | no | no | R | ❌ Vite-only shell (migration step 7) |
| `lib/navigation.tsx` | implements every adapter API | yes | yes | — | — | — | — | R | ❌ the adapter itself |
| `hooks/useCurrentPathname.ts` | `useLocation` fallback | yes | yes | yes | no | no | no | B | ❌ seam (already migration-only) |

**Headline:** only 4 files had a route-parameter dependency that was safe to migrate. Eight of the 16 `useLocation` uses exist solely to feed `/login`'s `state` object — that is the auth `history.state` bridge, which the brief explicitly protects.

---

## 2. Files migrated

| File | Previous | New |
|---|---|---|
| `src/views/TagFeed.tsx` | `useParams<{ tagName: string }>()` | `useCurrentParams<{ tagName: string }>()` |
| `src/views/CommunityDetail.tsx` | `useParams<{ slug: string }>()` | `useCurrentParams<{ slug: string }>()` |
| `src/views/LeadDetail.tsx` | `useParams<{ leadId: string }>()` | `useCurrentParams<{ leadId: string }>()` |
| `src/views/PostDetail.tsx` | `useParams()` | `useCurrentParams<{ id: string }>()` |
| `src/views/NotFound.tsx` | `useLocation().pathname` | `useCurrentPathname()` |
| `src/hooks/useCurrentParams.ts` | — | **new** migration seam |
| `src/test/phase04-route-state.test.tsx` | — | **new** 10 tests |
| `src/test/phase03-navigation.test.tsx` | inventory snapshot | updated to the Phase 0.4 reality |
| `docs/PHASE_0.4_ROUTE_STATE.md` | — | this report |

`useNavigate` imports in `CommunityDetail`, `PostDetail` and `TagFeed` were **deliberately left untouched** — step 4 work (§4).

**Measured change in API usage (production files):**

| API | Before | After |
|---|---|---|
| `useParams` | 6 | **3** (4 views migrated; remainder = `Profile` + `App.tsx` + the seam) |
| `useLocation` | 10 | 10 (all retained: auth state bridge / writers / Vite shell) |
| `useSearchParams` | 2 | 2 (retained — §5.2) |
| `useNavigate` | 19 | 19 (step 4 — intentionally untouched) |
| `Link` | 21 | 21 (step 7 riders) |

Total files importing `react-router-dom`: 32 → 33. The +1 is the new `useCurrentParams` seam, which by design imports React Router; the migrated views still need it for `Link`/`useNavigate`.

---

## 3. Files intentionally retained

| File | Why it stays on the compatibility layer |
|---|---|
| `views/Index.tsx`, `views/CreatePost.tsx` | `useSearchParams` — see §5.2. The adapter **already** implements this on `next/navigation` in the Next build. |
| `views/Profile.tsx` | `useParams` + `useLocation` both feed `<Link to="/login" state={{ from: pageLocation }}>`. Migrating params while keeping location would split one file across two sources of truth for no gain. |
| `views/LeadsBoard.tsx`, `components/PollWidget.tsx` | `useLocation` exists only to populate the `/login` `state` object. |
| `views/Login.tsx`, `views/Signup.tsx`, `components/ProtectedRoute.tsx` | **Auth surface — explicitly out of scope** (§8). |
| `App.tsx` | Vite router shell; retires in migration step 7. |
| `lib/navigation.tsx` | The adapter. Not removed in this phase. |

---

## 4. Remaining navigation writers (inventoried, NOT migrated)

19 production files use `useNavigate`. Classified by what the writer actually does:

| Class | Files | Safe to migrate directly? | Why |
|---|---|---|---|
| **A — submit-to-destination writers** (imperative push after an action) | `CreateLead`, `CreatePost`, `Drafts`, `MyReports`, `Notifications`, `Onboarding`, `ForgotPassword`, `ResetPassword`, `UserMeRedirect`, `modals/CreateCommunityModal`, `ComposerBar`, `NotificationBell`, `AppLayout` | **Yes, in step 4** | Single `navigate("/x")` / `navigate(path, {replace})`; `next/navigation`'s `useRouter()` covers both. |
| **B — history traversal** | `views/NotFound.tsx` (`navigate(-1)`), `CommunityDetail`, `PostDetail`, `TagFeed` (back buttons) | **Partly** | `router.back()` exists, but next/navigation exposes no `navigate(+1)`/`forward`; every observed use is `-1`, so step 4 is viable after confirming none need `+1`. |
| **C — auth-redirect writers** | `Login`, `Signup` (`Navigate` element + `navigate` after auth) | **No — defer to the auth phase** | Coupled to `location.state` and session timing. |
| **D — Vite-only** | `App.tsx` (legacy `/u/:username` redirect) | **No** | Retires with Vite. |

**Why none were migrated here:** `next/navigation`'s `useRouter()` **throws** without an App Router context (`invariant expected app router to be mounted`). Guarding it with `try/catch` is a genuine `react-hooks/rules-of-hooks` violation — verified twice this phase (ESLint flagged it both times, and a test caught the runtime throw). A dual-runtime writer seam is therefore *not* "minimal": it needs a hook whose validity depends on a runtime probe. Step 4 should instead **extract Next-specific route wrappers** (Strategy C) for the views Vite no longer needs, rather than adding a fourth runtime hook.

---

## 5. Dual-runtime architecture findings

### 5.1 `useParams` is safe in both runtimes; `useLocation` is not

Measured, not assumed:

| Hook (outside a Router / App Router) | Behaviour |
|---|---|
| RR `useParams()` | returns `{}` — safe |
| `next/navigation` `useParams()` | returns `null` — safe |
| RR `useLocation()` | **throws** `useLocation() may be used only in the context of a <Router>` |
| `next/navigation` `useRouter()` | **throws** `invariant expected app router to be mounted` |

Parameter names also match exactly across both route tables — `/b/[slug]`, `/l/[leadId]`, `/p/[id]`, `/b/[slug]/p/[id]`, `/tag/[tagName]`, `/f/[handle]` (React Router calls that last one `:username`, so `Profile` reads `uid || username || handle` and works under both). **No URL changed.**

### 5.2 `useSearchParams` migration was attempted, then reverted — with reason

I first wrote a `useCurrentSearchParams` seam and migrated `Index` + `CreatePost`. It broke six `CreatePost` tests because the seam called `useRouter()` unconditionally.

The deeper point: **in the Next build, `react-router-dom` *is* `src/lib/navigation.tsx`** (see the `next.config.mjs` alias), and the adapter's `useSearchParams` is *already* implemented on `next/navigation`'s `useSearchParams` + `useRouter`. So the Next build is natively migrated **today**; only the Vite branch still uses the real package. A new hook would duplicate the adapter, add a fourth runtime hook, and gain nothing — exactly the "permanent architectural complexity" the brief forbids. The file was deleted and both views reverted.

**Recommendation:** `useSearchParams` needs no seam. Retire it with the adapter in step 6/7.

### 5.3 React Router `location.state` has no native equivalent — and it is load-bearing

Eight call sites pass `state={{ from: location }}` / `state={{ from: { pathname } }}` into `/login`, and `Login`/`Signup` read `location.state` via `postAuthRedirect()`. The adapter implements this by writing to `history.state` under `__borynx_nav_state` (Phase 0.2). Next.js has **no per-navigation state object**, so there is no clean equivalent.

Options, with my assessment:

| Option | Verdict |
|---|---|
| URL search param (`/login?from=/b/developers`) | **Best** — shareable, survives reload, no bridge. Requires touching `ProtectedRoute`/`Login`/`Signup`, so it belongs to the **auth phase**. |
| `sessionStorage` | Works, but adds client-state plumbing and dies in a new tab. |
| Keep `history.state` bridge | Acceptable today; must be re-implemented (not aliased) once the adapter is gone. |

**Documented, not forced.** All eight sites stay on the adapter this phase.

### 5.4 Do not over-invest in the Vite path

Confirmed by this phase: the Vite app is a rollback path only, and every seam added for it is debt to delete at step 7. Phase 0.4 added exactly **one** seam (`useCurrentParams`) because four shared views needed it, and added **zero** dual-runtime writers. Where a seam would have been non-minimal (query params, navigation writers), the file stayed on the adapter and the trade-off is documented above.

---

## 6. Client/server boundaries

**No new `"use client"` on any page or view.** Every route shell remains a client-only `dynamic(..., { ssr: false })` mount, unchanged.

One new Client Component:

| File | Why client |
|---|---|
| `src/hooks/useCurrentParams.ts` | Calls `useParams()` from both runtimes (context reads); consumed only by already-client views. |

No server-only module is imported into a client component; no secret is exposed. The seams live in `src/hooks/` and stay client-side by construction.

---

## 7. Validation results

All executed on the final tree.

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **Pass**, 0 errors |
| ESLint | `npx eslint .` | **0 errors**, 6 warnings — all pre-existing (`react-refresh/only-export-components`) |
| Vitest | `npx vitest run` | **106/106 pass, 14 files** (was 97/97, 13 files; +10 new, −1 conditional-hook test withdrawn with §5.1 fix) |
| Next Turbopack build | `npm run build:next` | **Compiled successfully**, 32/32 static pages |
| Next webpack build | `npm run build:next:webpack` | **Compiled successfully**, 32/32 static pages |
| Vite build | `npm run build` | **built in ~11s**, no errors |
| Route smoke — `next start` (webpack) | `SMOKE_BASE_URL=… node scripts/server-smoke.mjs` | **44/44 pass** |
| Route smoke — `next dev` (Turbopack, :3000) | same | **44/44 pass** |
| Preview host | `Host: 3000-abc.e2b.app` | **200** |

**Targeted route-state verification (HTTP):**

| Case | Result |
|---|---|
| `/b/developers`, `/b/developers/p/post-42`, `/p/post-42`, `/l/lead-1` | 200 |
| `/tag/react`, `/tag/react%20native` (encoded segment) | 200 |
| `/f/joseph`, `/f/me` | 200 |
| `/?feed=following`, `/?feed=bogus`, `/submit?type=resource`, `/submit?space=developers`, `/submit?type=bogus` | 200 (unknown values fall back, no crash) |
| Redirect aliases `/b`, `/p`, `/f`, `/u`, `/following` | 200 |
| `/does-not-exist` | 404 |
| `/b/`, `/p/` | 308 (Next trailing-slash normalisation) |
| Vite rollback: `/`, `/b/developers`, `/b/developers/p/post-42`, `/p/post-42`, `/l/lead-1`, `/tag/react`, `/?feed=following`, `/submit?type=resource` | 200 |

**Runtime seam behaviour (jsdom):** params resolve to `developers` in the React Router runtime and to `lead-1` when the App Router provider is mocked; absent params are `undefined` (never the string `"undefined"`, never a throw); `react%20native` decodes to `react native`.

**Browser validation status: NO REAL BROWSER WAS AVAILABLE.** Playwright/Puppeteer and Chrome-for-Testing CDNs remain unreachable and `apt-get` needs root. Everything above is automated, jsdom-level, or HTTP/SSR-level. §9 lists what a human must still confirm.

---

## 8. Recommended next step

**Phase 0.5 — migration step 4: navigation writers, via Next-specific extraction (Strategy C), not a new seam.**

Concretely, in this order:

1. **Class A writers** (13 files) that only push a destination — extract a small `useNextNavigate()` used by the file itself and let the Vite copy keep the adapter, *or* migrate the whole file if the verification in step 2 shows Vite no longer needs it.
2. Before any of that, **decide the Vite exit date.** Every remaining step-3/4 file costs a seam or a duplicate. Merging `main` behind Next and freezing `src/App.tsx` would remove ~30 files from scope at once.
3. Then **step 5 (auth)** — where `/login?from=…` should replace the `history.state` bridge (§5.3), unlocking the eight retained `useLocation` sites and `Profile`.

Do **not** delete `src/lib/navigation.tsx`, drop `react-router-dom`, or touch `ProtectedRoute` / `Login` / `Signup` before step 5.

**Do not proceed automatically — awaiting approval.**

---

## 9. Human verification checklist

1. `/b/developers` renders the space; `/b/does-not-exist` shows the not-found state, not a crash.
2. `/b/developers/p/<id>` and `/p/<id>` render the same post; nested params resolve.
3. `/l/<id>` renders the lead detail.
4. `/tag/react` and `/tag/react%20native` render the right feed.
5. `/f/<handle>` renders the profile; `/f/me` redirects to your own handle.
6. Home feed: switching **For You / Following** updates the URL to `?feed=following` and back, and a reload preserves the tab.
7. `/submit?type=resource` opens the composer on the resource type; `/submit?space=<slug>` preselects that space.
8. Unknown route shows the 404 view with the path echoed, and "Go back" works.
9. Browser console: no hydration warnings, no React errors, no "app router must be mounted".
10. `npm run dev` (Vite, 8080): repeat 1–4, 6–8 — the rollback app must still work identically.
