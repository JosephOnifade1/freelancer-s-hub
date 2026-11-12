# Phase 1 — Authentication & Identity

Branch `arena/e62bd8c8-freelancer-s-hub`, based on `migration/nextjs-app-router` @ `18667f3`.
`main` untouched. Supabase Auth retained — no Neon, no Drizzle, no schema or data migration.

**Verification class:** everything below is automated (tsc, ESLint, Vitest in jsdom, `next build`,
HTTP smoke against `next start`). **No real browser was available**, so no claim here rests on
browser verification.

---

## 1. Authentication architecture

| Moment | What happens now |
| --- | --- |
| **Anonymous request to a private route** | `AuthGate` renders `null`. The provider holds every child until the session is known, so nothing private is painted while the session is unknown and nothing private is painted for a signed-out visitor either. `router.replace("/login?from=<current path>")`. |
| **Return path** | The destination travels as a query parameter (`/login?from=%2Fsettings`), not React Router `history.state`. `sanitizeReturnPath` validates it; anything not a same-origin path falls back to `/`. |
| **Successful login** | Login/Signup read `from`, sanitise it, and `router.replace(...)` to it, or `/` when absent/invalid. OAuth round trips now return to the same validated destination. |
| **Session restoration** | `AuthProvider` reads `getSession()` once on mount and mirrors `onAuthStateChange`. `AuthGate` waits for it, so a refresh on a private route does not flicker. |
| **Logout** | `signOut()` clears the Supabase session, drops the viewer (`setUser(null)`), clears the QueryClient cache, then `AppLayout` pushes `/login`. Private routes become unrenderable immediately because `AuthGate` sees `user === null`. |

### The phase's central finding

**No Next.js page was protected at all.** `ProtectedRoute` was wired only into the frozen Vite
`src/App.tsx` route table, so on the canonical (Next) runtime all 13 private routes rendered openly.
That is a regression introduced when the App Router pages were created, not a design decision. It is
now closed for every private route that the legacy table guards.

**Middleware was rejected deliberately.** The session lives in browser storage via the Supabase JS
client; there is no `@supabase/ssr` cookie client, no `middleware.ts`/`proxy.ts`, and no auth callback
route. A server-side check would see no session and bounce signed-in users. Middleware becomes the
right answer only once sessions move to cookies.

---

## 2. Files changed and why

**New**

| File | Why |
| --- | --- |
| `src/lib/return-path.ts` | Single validation point for `?from=`: `sanitizeReturnPath`, `loginPath`, `readReturnPath`, `DEFAULT_RETURN_PATH`. |
| `src/components/AuthGate.tsx` | Client guard for App Router private routes — holds while the session resolves, redirects when signed out. |
| `src/test/phase01-return-path.test.ts` | 41 open-redirect tests. |
| `src/test/phase01-auth-flow.test.tsx` | 12 tests: `AuthGate` gating/no-flash/return path, Login destination + rejection cases. |
| `src/test/phase01-logout.test.tsx` | 7 tests: session restore, single session fetch, no-flicker, cache clearing on identity change and on logout. |

**Modified**

| File | Change |
| --- | --- |
| `src/lib/auth.ts` | `postAuthRedirect` now takes a `string \| null \| undefined` and delegates to `sanitizeReturnPath`; the `LocationLike`/`state` handling is gone. |
| `src/hooks/useAuth.tsx` | `signOut` clears the viewer and the QueryClient cache in a `finally`, so a failed network sign-out cannot leave a live session or another account's cached rows behind. |
| `src/views/Login.tsx`, `src/views/Signup.tsx` | Off React Router: `useRouter`/`useSearchParams`, `AppLink`, `readReturnPath` → `postAuthRedirect`. The "already signed in" redirect moved into an effect (it ran during render, mirroring the old `<Navigate>`). OAuth `redirectTo` honours the validated destination instead of hardcoding `/`. |
| 9 login call sites (`ComposerBar`, `PollWidget`, `Communities`, `CommunityDetail`, `LeadDetail`, `LeadsBoard`, `PostDetail`, `Profile`) | `to="/login" state={{ from }}` → `href={loginPath(...)}`. `useLocation` dropped where it only existed for that hand-off. |
| 14 route shells under `src/app/**` | Wrapped in `AuthGate`: `onboarding`, `submit`, `pipeline`, `applications`, `notifications`, `admin`, `bookmarks`, `achievements`, `my-reports`, `settings`, `drafts`, `premium`, `l/post`, `f/me`, plus the `/following` redirect. |
| `src/test/PostDetail.test.tsx` | Guest sign-in link now carries `?from=`. |
| `src/test/phase02/03/04/05` | Source guards updated to the new contract (inventory may shrink; the auth views must now be native). |

**Not touched:** `src/App.tsx`, `src/components/ProtectedRoute.tsx`, `src/lib/navigation.tsx`,
`react-router-dom` in `package.json`, the Vite build, UI/design, Supabase config.

---

## 3. Redirect security

`sanitizeReturnPath` accepts only a same-origin absolute path and returns `/` otherwise. Rejected, all
tested: `https://evil.example`, `//evil.example`, `/\evil.example`, `\\host`, `/\ /host`,
`javascript:`, `java\nscript:`, `data:`, `vbscript:`, `file:`, `/%2F%2Fhost`, `/%5Chost`,
relative-without-slash, whitespace- or tab-padded values, empty string, non-strings, and auth-loop
targets (`/login`, `/signup`, `/forgot-password`, `/reset-password`, with or without query) —
while `/logins` is correctly *not* over-blocked. Accepted: `/`, `/settings`, `/b/design/p/42`,
queries, fragments, `%20`-encoded paths. 41/41 tests.

Control characters are detected by code-point comparison rather than a control-character regex, which
keeps `no-control-regex` clean without weakening the check.

---

## 4. Supabase integration

Unchanged in kind, hardened in behaviour: one browser client (`src/lib/supabase.ts`), `NEXT_PUBLIC_*`
public values read as literals so Next can inline them, demo-mode mock client, placeholder fallback.
**No server client, no cookie handling, no callback route was added** — the brief asked for them "where
required", and with a browser-storage session they are not required yet. No secrets are read, printed,
or moved into the client bundle; no environment values appear in this report.

Verified behaviours: session restoration on mount, exactly one `getSession` per mount, no auth flicker
(children stay unmounted until known), cache clearing on identity change, cache clearing on logout even
when the network call fails.

---

## 5. React Router reduction

**Removed from production auth code:** `useLocation` and `state={{ from }}` in all 9 login call sites,
`useLocation` and `<Navigate>` in Login/Signup, and the `history.state` bridge for post-login redirects.
`postAuthRedirect` no longer accepts location state.

**Remaining production consumers** (unchanged surface, 22 files): `App.tsx` (the Vite table),
`components/{AppLayout, AppLink, NotificationBell, ProtectedRoute}`, `hooks/{useCurrentParams,
useCurrentPathname}`, `legacy-next/*`, and the views that still render RR `Link` for non-auth
navigation (`Communities`, `CommunityDetail`, `CreatePost`, `Drafts`, `ForgotPassword`, `Index`,
`LeadDetail`, `LeadsBoard`, `MyReports`, `NotFound`, `PostDetail`, `Profile`, `ResetPassword`).

**Adapter exports still needed:** `Link`, `useNavigate`, `useLocation`, `useParams`,
`useSearchParams`, `Navigate` — all reachable because `src/lib/navigation.tsx` is aliased to
`react-router-dom` in the Next build. Nothing was removed: the APIs still have consumers, and the
brief forbids removing an adapter API before its last consumer is gone.

---

## 6. Tests (actual results)

| Suite | Result |
| --- | --- |
| `phase01-return-path.test.ts` | 41 passed |
| `phase01-auth-flow.test.tsx` | 12 passed |
| `phase01-logout.test.tsx` | 7 passed |
| `PostDetail.test.tsx` | 8 passed |
| `phase02/03/04/05` source guards | 24 / 20 / 10 / 11 passed |
| Other suites | all passed |
| **Total** | **178 passed / 178, 18 files** |

Coverage of the required list: protected → login ✓, login → destination ✓, login → fallback `/` ✓,
invalid return path → `/` ✓, logout ✓, session restoration ✓, valid/nested/query string ✓,
external/protocol-relative/`javascript:`/malformed/missing ✓, existing navigation regressions ✓.

---

## 7. Validation

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | 0 errors |
| `npx tsc -p tsconfig.legacy.json --noEmit` | 0 errors |
| `npx eslint src` | 0 errors, 6 pre-existing `react-refresh/only-export-components` warnings (identical to the Phase 0.5 baseline) |
| `npx vitest run` | 178/178 |
| `npm run build:next` (Turbopack) | success, 40 routes |
| `npm run build:next:webpack` | success, 40 routes |
| `npm run build:legacy` (Vite rollback) | success |
| Route smoke against `next start` | 22/22 routes HTTP 200, including `/login?from=%2Fsettings` |

---

## 8. Known limitations

1. **No browser verification.** Redirect-on-load, cookie/storage behaviour across reloads, OAuth round
   trips and the real Supabase network path are unverified in a real browser. The smoke test proves the
   servers respond, not that the client flow completes.
2. **Session still lives in browser storage.** Server components can never see the user, so protection
   is and must be client-side. This is also why every private page is a client shell with a spinner.
3. **`AuthGate` gates the page, not the data.** Supabase RLS remains the only server-side authority;
   the guard is UX, not a security boundary.
4. **Every private route now costs a client round trip before content appears** — the pre-existing
   `ssr: false` shells, unchanged in kind.
5. **Email-confirmation behaviour is whatever the Supabase project is configured to do.** The
   implementation branches on `data.user && !data.session`: when confirmation is required it shows the
   "check your inbox" state with a resend link and `emailRedirectTo` of `/login`; when it is not, it
   goes straight to `/onboarding`. Nothing was invented, and the project's dashboard setting was not
   readable from here.
6. **Onboarding is not enforced.** Nothing routes a new user to `/onboarding` except the signup
   success path and a feed CTA; a user who arrives via `/` never sees it. Not changed — that is a
   product rule, not an auth bug.
7. **`ProtectedRoute` still exists** for the Vite build and still uses `history.state`; the two runtimes
   therefore have two different mechanisms until Vite is retired.
8. **The `/login` route itself is not gated** — correct (it is public), and the view redirects an
   already-signed-in visitor in an effect.

---

## 9. Recommended next phase

**Phase 2 — Session transport and server-visible identity.** Move the session to cookies with
`@supabase/ssr` (browser + server clients, refresh in middleware/`proxy.ts`), which then allows
route protection at the edge, real server components for private data, and the removal of the
client-side `AuthGate` as the primary guard. Everything in Phase 1 is designed to be replaced by that
without touching a single call site: the `?from=` contract and the sanitizer stay valid, and
`AuthGate` can shrink to a fallback.

If that is too large for one phase, the cheaper alternative is **Phase 2a — Onboarding and identity
boundary**: decide whether onboarding is mandatory, and document the split between Supabase auth
identity and the profile data currently written to the Supabase `profiles` table by `ensureUserProfile`
(the coupling that the later Neon + Drizzle phase must break).

---

## Awaiting approval

No further work has been started. The working tree is uncommitted on
`arena/e62bd8c8-freelancer-s-hub`.
