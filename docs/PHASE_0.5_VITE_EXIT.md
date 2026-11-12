# Borynx — Phase 0.5: Vite Exit Strategy & Native Next.js Navigation

**Branch:** `arena/d81deef2-freelancer-s-hub` → target `migration/nextjs-app-router`
**Base:** `50824ed` (Phase 0.4 merge)
**Date:** 12 November 2026
**Decision implemented:** the App Router is the canonical runtime; Vite is a frozen rollback snapshot.

---

## 1. Vite exit status

### What remains for rollback (preserved, not maintained)

| Item | Status | Notes |
|---|---|---|
| `src/App.tsx` | **Preserved** | The SPA router shell: `BrowserRouter` + 41 `<Route>`s. Untouched this phase. |
| `src/main.tsx`, `index.html` | **Preserved** | Vite entry points. |
| `vite.config.ts` | **Preserved** | One addition: `next/*` aliases for the rollback build only. |
| `vitest.config.ts` | **Preserved** | Same aliases, so shared views still test against React Router. |
| `dist/` output | **Buildable** | Verified: `npm run build:legacy` succeeds (21.4 s). |
| `react-router-dom` | **Retained** | Still a dependency; still the adapter's implementation. |
| `src/lib/navigation.tsx` | **Retained, reduced** | See §3. |

### What is now legacy-only (no longer an active target)

- Any new Borynx feature. New code imports `next/link` / `next/navigation` directly.
- Vite compatibility as a validation target for Next-native work. Vite is built **once** in §6 as a snapshot check, not on every phase.
- The `App.tsx` route table as a source of truth. `src/lib/route-parity.ts` (36 → 40 entries) is the contract, enforced by a test that walks `src/app/**/page.tsx`.

### How to run the rollback application

```bash
npm run dev:legacy        # vite dev server, port 8080
npm run build:legacy      # production build → dist/
npm run preview:legacy    # serve the built snapshot, port 8080
npm run typecheck:legacy  # typecheck against the legacy next/* shims
```

`npm run dev` / `npm run build` still work unchanged as aliases for the same thing.

### How the frozen snapshot keeps working without app-code changes

The snapshot has no App Router, so `next/navigation` and `next/link` would otherwise throw or degrade. Rather than scatter conditionals through app code, the **legacy build supplies the `next/*` surface**:

| File | Purpose | Used by Next? |
|---|---|---|
| `src/legacy-next/next-navigation.ts` | `usePathname`, `useRouter`, `useParams`, `useSearchParams`, `useSelectedLayoutSegment` implemented on React Router | **No** |
| `src/legacy-next/next-link.tsx` | `next/link` → React Router `Link` (keeps SPA navigation) | **No** |
| `tsconfig.legacy.json` | Maps `next/*` for the legacy typecheck | **No** |

Wired in via `vite.config.ts`, `vitest.config.ts` and `tsconfig.legacy.json` only. The Next build never resolves these paths — `next.config.mjs` aliases only `react-router-dom`. **This is a shim for a frozen target, not a navigation framework**; the Next build still imports the real modules.

---

## 2. Navigation migration

17 files moved from React Router writers to native `next/navigation`.

| File | Previous | New |
|---|---|---|
| `components/AppLayout.tsx` | `useNavigate` (7 calls) | `useRouter().push` |
| `components/ComposerBar.tsx` | `useNavigate` | `router.push(`/submit?${params}`)` |
| `components/NotificationBell.tsx` | `useNavigate` | `router.push(notificationLink(n))` |
| `components/modals/CreateCommunityModal.tsx` | `useNavigate` | `router.push(`/b/${slug}`)` |
| `components/ComingSoon.tsx` | RR `Link` | `AppLink` (native `href`) |
| `views/CommunityDetail.tsx` | `useNavigate` | `router.push("/communities")` |
| `views/CreateLead.tsx` | `useNavigate` | `router.push(`/l/${id}`)`, `router.push("/l")` |
| `views/CreatePost.tsx` | `useNavigate` | `router.push(postUrl)`, `router.back()` |
| `views/Drafts.tsx` | `useNavigate` | `router.push("/submit?restore=1")` |
| `views/Index.tsx` | `useNavigate` | `router.push("/submit")` |
| `views/MyReports.tsx` | `useNavigate` (**unused**) | dead import removed |
| `views/NotFound.tsx` | `useNavigate` | `router.back()` |
| `views/Notifications.tsx` | `useNavigate` | `router.push(notificationLink(n))` |
| `views/Onboarding.tsx` | `useNavigate` + `{replace:true}` | `router.replace("/")` |
| `views/PostDetail.tsx` | `useNavigate` | `router.push("/")`, `router.back()` |
| `views/ResetPassword.tsx` | `useNavigate` + `{replace:true}` | `router.replace("/")`, `router.push("/forgot-password")` |
| `views/TagFeed.tsx` | `useNavigate` | `router.back()` |
| `views/UserMeRedirect.tsx` | `useNavigate` | `router.push(...)` (deps array updated) |

**Behaviour preserved, verified by tests:**
- `navigate(-1)` → `router.back()` (no call site needed `+1`; see §4 of Phase 0.4).
- `navigate(x, { replace: true })` → `router.replace(x)`.
- Query strings kept verbatim: `/submit?${params}`, `/submit?restore=1`, `/submit?type=…&space=…`.
- Dynamic destinations kept verbatim: `/b/${slug}`, `/b/${slug}/p/${id}`, `/p/${id}`, `/l/${leadId}`, `/f/${handle}`.
- No URL string changed anywhere.

---

## 3. Compatibility adapter status

### Removed (zero production consumers — verified before deletion)

| Export | Why it was dead |
|---|---|
| `NavLink` (+ `NavLinkProps`) | Since Phase 0.3 the sidebar uses `@/components/NavLink`. No file imported the adapter's version; only a test did. |
| `MemoryRouter`, `Routes`, `Route` | Testing stubs. Tests import the real `react-router-dom` via Vite aliasing; `App.tsx` uses the real components. |

### Retained (live consumers — each mapped below)

| Export | Remaining consumers |
|---|---|
| `Link` | 20 files. The `state=` bridge is load-bearing: `Communities` (×2), `ComposerBar`, `PollWidget`, `Profile`, `LeadsBoard`, `CommunityDetail`, `LeadDetail`, `PostDetail` pass `state={{ from: location }}` into `/login`. |
| `useNavigate` | `Login`, `Signup` (auth surface, §5). |
| `useLocation` | 9 files — auth state bridge + `Profile`. |
| `useParams` | `Profile`, `App.tsx`, `hooks/useCurrentParams.ts`. |
| `useSearchParams` | `Index`, `CreatePost`. |
| `Navigate` | `ProtectedRoute`, `Login`, `Signup`, `App.tsx`, `ForgotPassword`. |
| `CompatibleLinkProps`, `URLSearchParamsInit` | Types for the above. |

Production files importing `react-router-dom`: **32 → 26** (§5 of the diff), of which 2 are the new legacy shims and 2 are Phase 0.3/0.4 seams. `react-router-dom` was **not** removed from `package.json`.

---

## 4. Route coverage

**Every Borynx route now has a native App Router equivalent.** 40 pages under `src/app/**` (was 36).

### Four hidden routes found and fixed

The Step 6 audit compared `src/App.tsx`'s route table against `src/app/**` and found routes that existed **only** in the SPA — they returned **404 on the canonical runtime**:

| Route | SPA behaviour | Previous Next behaviour | Fix |
|---|---|---|---|
| `/pricing` | `StandaloneComingSoon` | **404** | `src/app/pricing/page.tsx` — client page reusing `ComingSoon`, same copy |
| `/status` | `StandaloneComingSoon` | **404** | `src/app/status/page.tsx` — same |
| `/premium` | `ProtectedRoute` → `ComingSoonPage` | **404** | `src/app/premium/page.tsx` — `AppLayout` + `ComingSoon` |
| `/u/:username` | `LegacyProfileRedirect` → `/f/:username` | **404** | `src/app/u/[username]/page.tsx` — native `router.replace` redirect, `role="status"` fallback |

`/premium` deliberately has **no** `ProtectedRoute`: route protection belongs to Phase 1 (§5). The page is a placeholder exposing no data.

All four added to `src/lib/route-parity.ts` (now 40 entries) so the parity test and the smoke runner cover them permanently.

### Coverage by group

| Group | Routes | Status |
|---|---|---|
| Public | `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/pricing`, `/status` | ✅ native |
| Feeds | `/new`, `/popular`, `/tag/[tagName]`, `/following` | ✅ native |
| Communities | `/communities`, `/b/[slug]`, `/b` (alias) | ✅ native |
| Posts | `/p/[id]`, `/b/[slug]/p/[id]`, `/submit`, `/drafts` | ✅ native |
| Profiles | `/f/[handle]`, `/f/me`, `/u/[username]`, `/leaderboard` | ✅ native |
| Leads | `/l`, `/l/[leadId]`, `/l/post`, `/pipeline`, `/applications` | ✅ native |
| Account | `/settings`, `/bookmarks`, `/achievements`, `/my-reports`, `/notifications`, `/admin`, `/premium`, `/onboarding` | ✅ native |
| Redirects | `/p`, `/f`, `/u` → `/` | ✅ native |
| Fallback | any unknown path | ✅ 404 |

**No route still depends on the SPA shell.**

---

## 5. Authentication dependencies (intentionally untouched → Phase 1)

| Item | State | Why |
|---|---|---|
| `hooks/useAuth.tsx`, `hooks/auth-context.ts` | **Untouched** | Session architecture; `getSession`/`onAuthStateChange` unchanged. |
| `components/ProtectedRoute.tsx` | **Untouched** | Uses `useLocation` + `<Navigate state={{from}}>`; the redirect *is* the auth bridge. |
| `views/Login.tsx`, `views/Signup.tsx` | **Untouched** | `location.state` → `postAuthRedirect()`. Migrating these without an equivalent for `location.state` would change behaviour. |
| `lib/auth.ts` | **Untouched** | `postAuthRedirect` contract asserted by a test. |
| The 8 `state={{ from: location }}` call sites | **Retained on the adapter** | Same reason. |

**Phase 1 recommendation:** replace the `history.state` bridge with `/login?from=<path>`, which is shareable, survives reload, and needs no bridge. That is what unlocks `Login`, `Signup`, `ProtectedRoute`, `Profile` and the remaining `useLocation` sites.

---

## 6. Validation

All executed on the final tree.

| Check | Command | Result |
|---|---|---|
| TypeScript (canonical) | `npx tsc --noEmit` | **Pass**, 0 errors |
| TypeScript (legacy) | `npx tsc --noEmit -p tsconfig.legacy.json` | **Pass**, 0 errors |
| ESLint | `npx eslint .` | **0 errors**, 6 warnings — all pre-existing |
| Vitest | `npx vitest run` | **116/116, 15 files** (was 106/106, 14; +11 Phase 0.5 tests, −1 removed with the dead `NavLink` export) |
| Next Turbopack build | `npm run build:next` | **Compiled successfully**, **35/35** static pages |
| Next webpack build | `npm run build:next:webpack` | **Compiled successfully**, **35/35** static pages |
| Route smoke — `next start` | `SMOKE_BASE_URL=… node scripts/server-smoke.mjs` | **48/48** (was 44; +4 restored routes) |
| Route smoke — `next dev` | same, port 3000 | **48/48** |
| Vite rollback build | `npm run build:legacy` | **built in 21.4 s**, no errors |
| Vite rollback serve | `vite preview :8080` | 200 on `/`, `/login`, `/pricing`, `/status`, `/premium`, `/u/joseph`, `/b/developers`, `/l/lead-1`, `/submit`, `/drafts` |
| Preview host | `Host: 3000-abc.e2b.app` | **200** |

**URL behaviour verified:** 36 distinct shapes 200 (`/` … `/following`), query strings (`/?feed=following`, `/submit?type=resource&space=x`) 200, unknown path 404, trailing slash 308 (Next normalisation), `/u/joseph` now 200 instead of 404.

**Legacy shim semantics verified in jsdom:** `useRouter().push` → `/communities`, `.replace` → `/settings`, `.back()` → `/l` — all via React Router, client-side, no reload warning.

**Browser validation status: NO REAL BROWSER WAS AVAILABLE.** Playwright/Puppeteer and Chrome-for-Testing CDNs remain unreachable; `apt-get` needs root. Everything above is automated, jsdom-level or HTTP/SSR-level. §7 lists what a human must confirm.

---

## 7. Recommended next phase

**Phase 1 — authentication, starting with the `location.state` bridge.**

1. Move the post-auth destination into the URL: `/login?from=<encoded path>`; delete the `history.state` write/read from the adapter.
2. Migrate `Login`, `Signup`, `ProtectedRoute` to `next/navigation`, including `<Navigate>` → `router.replace` in an effect (or a server-side `redirect` once protection moves to layouts).
3. Once the bridge is gone, migrate the last `Link` consumers (`Profile`, `Communities`, `ComposerBar`, `PollWidget`, `LeadsBoard`, `CommunityDetail`, `LeadDetail`, `PostDetail`) to `next/link` with no loss.
4. Delete `hooks/useCurrentPathname` / `useCurrentParams` / `AppLink`'s React Router branch, then the adapter itself.

After Phase 1 the only remaining Vite dependency is `src/App.tsx` + `src/main.tsx`, at which point the rollback snapshot can be archived per your call.

**Do not proceed automatically — awaiting approval.**

---

## 8. Human verification checklist

1. Click through: composer bar → `/submit?type=…`, notification bell → target, sidebar → `/settings`, avatar menu → profile/drafts/settings. No full page reload.
2. `/onboarding` "Skip"/"Finish" **replaces** history (Back should not return to onboarding).
3. `/reset-password` success redirect replaces history.
4. Post detail "Back" and 404 "Go back" use browser history correctly.
5. `/pricing`, `/status`, `/premium` render the coming-soon pages (previously 404).
6. `/u/<handle>` redirects to `/f/<handle>` and the back button returns to where you came from.
7. Sign in flow: visiting a protected URL while signed out lands on `/login`, and after signing in you return to the original page (the auth bridge — must be unchanged).
8. `/does-not-exist` shows the 404 view with the path echoed.
9. Browser console: no hydration warnings, no "app router must be mounted", no React errors.
10. Rollback snapshot: `npm run build:legacy && npm run preview:legacy` → repeat 1–8 on :8080.
