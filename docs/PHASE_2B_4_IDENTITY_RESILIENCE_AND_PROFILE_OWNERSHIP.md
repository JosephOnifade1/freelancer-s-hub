# Phase 2B.4 — Identity Provisioning Resilience & Profile Ownership Audit

> **Verification status.** No real-Neon connection was made in this phase: Arena has
> no database credentials, as established in 2B.3. Every database result below is
> **local PostgreSQL 18.6**. Mocked and jsdom tests are labelled as such. Nothing
> here claims Neon-specific behaviour was verified — see §12.

---

## §1. Branch and starting commit

| Item | Value |
| --- | --- |
| Branch | `arena/178f33c3-freelancer-s-hub` |
| Starting commit | `51fd3ac2b776efe91b337eb012f63963fe24851f` (merge of PR #27) |
| Base | `migration/nextjs-app-router` |
| `main` | **`1d18864`, untouched** — see §13 |
| Tree at start | clean |

No reset, clean or regeneration. No branch switch. No PR opened or merged.

## §2. Files inspected and changed

### Created

| File | Purpose |
| --- | --- |
| `src/lib/provisioning-state.ts` | Pure provisioning state machine + retry policy. |
| `src/components/ProfileProvisioningNotice.tsx` | Recoverable-failure notice with retry. |
| `src/test/phase2b.4-provisioning-state.test.ts` | 18 unit tests (pure). |
| `src/test/phase2b.4-provisioning-recovery.test.tsx` | 17 provider tests (jsdom + mocked network). |
| `src/test/phase2b.4-gate-and-notice.test.tsx` | 10 gate/notice tests (jsdom). |
| `docs/PHASE_2B_4_IDENTITY_RESILIENCE_AND_PROFILE_OWNERSHIP.md` | This report. |

### Modified

| File | Change |
| --- | --- |
| `src/hooks/useAuth.tsx` | Session and provisioning state separated; retry; de-duplication; logout clears provisioning. |
| `src/hooks/auth-context.ts` | `provisioning`, `retryProvisioning`, `isProvisioned` added. |
| `src/lib/profile-provisioning.ts` | `AbortSignal` support; doc updated for the new retry ownership. |
| `src/components/AppLayout.tsx` | Mounts `ProfileProvisioningNotice` beside the existing demo notice. |

### Read (evidence base)

`src/hooks/useAuth.tsx`, `src/hooks/auth-context.ts`, `src/components/AuthGate.tsx`,
`src/lib/profile-provisioning.ts`, `src/lib/provisioning-state.ts`,
`src/server/features/identity/{provision-profile,claim-username,index}.ts`,
`src/app/api/profile/{provision,username}/route.ts`,
`src/server/db/schema/identity.ts`, `src/lib/users.ts`, `src/lib/posts.ts`,
`src/lib/search.ts`, `src/lib/uploads.ts`, `src/lib/attachments.ts`,
`src/lib/stats.ts`, `src/lib/reports.ts`, `src/lib/applications.ts`,
`src/lib/notifications.ts`, `src/components/{AppLayout,VeteranCelebration}.tsx`,
`src/views/{Profile,Settings,Onboarding,Login,Signup,ResetPassword}.tsx`,
`src/app/auth/callback/route.ts`, `src/lib/supabase.ts`, `src/lib/supabase-env.ts`,
`src/proxy.ts`, `supabase_post_settings_and_storage_migration.sql`,
`src/test/phase01-{logout,auth-flow}.test.tsx`,
`src/test/phase1.1-session-architecture.test.ts`.

No schema, migration or API route was changed in this phase.

## §3. Identity workflow audit — actual sequence of events

`AuthProvider` installs **two** session sources in one effect: an
`onAuthStateChange` subscription, and a single `getSession()` call guarded by
`lastUid.current === undefined` so a late-resolving `getSession` cannot overwrite a
newer auth event. Both funnel into `acceptSession`. `acceptSession` is still the
only place a session becomes a viewer.

### 3.1 Successful password login

`Login.tsx` → `signInWithPassword` → `AuthProvider` provisions nothing yet →
`provisionProfileOnServer()` is still called explicitly in `Login.tsx` after
success → Supabase fires `SIGNED_IN` → `acceptSession` publishes the user and
starts an attempt → then `router.replace(redirectTo)`.

**Finding (F1).** The explicit call in `Login.tsx` is now **redundant**: the auth
event already starts a provisioning attempt, and the call inside `Login.tsx` is not
de-duplicated against it — it is a separate `fetch` from the same browser. Two
requests, one of which the provider does not own. Both are idempotent so nothing is
corrupted, but the duplicate is real waste and a second mechanism in the sense the
brief warns about. Mitigated, not removed: the provider de-duplicates *its own*
attempts, and the routes are idempotent. **Recommended removal in the cutover
phase** (§11.2), not now — removing it changes login latency behaviour and deserves
its own review.

### 3.2 Successful email-confirmation login

The account exists but has no session until the link is clicked, so `Signup.tsx`
correctly skips provisioning (`data.user && data.session`). The first session
arrives from the confirmation redirect, which lands on `/login` or `/`; the auth
event fires and `acceptSession` provisions. **No gap.** This was already correct
after the 2B.3 change and is unchanged.

### 3.3 Successful OAuth login

`/auth/callback` exchanges the code and sets cookies, then redirects to the
sanitised `next`. No provisioning happens in the route itself — the first client
paint calls `getSession()`, which resolves the new cookie session, and
`acceptSession` provisions. Same funnel as every other login. **Correct, and this
is why the callback was *not* made a second provisioning point.**

### 3.4 Existing user whose profile already exists

`POST /api/profile/provision` → `insert … on conflict (uid) do nothing returning`
returns zero rows → the profile is re-read → HTTP 200 → `existing` → `ready`.
No write, no overwrite. Proven against local PostgreSQL (`identity-integration`:
*"creates a profile once and is idempotent afterwards"*, *"does not overwrite a
profile the user has since edited"*).

### 3.5 New user whose profile must be created

Same route, one row returned → handle claimed → HTTP 201 → `created` → `ready`.
`role`/`isVerifiedPro` never written, so schema defaults hold.

### 3.6 Supabase Auth succeeds but Neon is unavailable

**This is the case that was broken before this phase.** In the 2B.3 code
`acceptSession` awaited `provisionProfileOnServer()` *before* `setUser()`. On 503 the
promise still resolved (the shim swallowed the failure) and `setUser` ran, so the
user was signed in — but the state was a bare `user` with no provisioning status, no
notice, and no retry path. The only recovery was a reload.

Now: `setUser`/`setLoading(false)` happen **immediately** on a known session, and
`provisioning` independently becomes `failed` with a reason. `AuthGate` passes the
user through, `ProfileProvisioningNotice` explains it, and `retryProvisioning` is
available. **A database failure cannot reach `unauthenticated`** — that transition
only occurs when Supabase reports no session.

### 3.7 Provisioning succeeds after a retry

`retryProvisioning()` → `attemptProvisioning` → 200/201 → `ready` →
`queryClient.invalidateQueries()`. The manual retry deliberately ignores the
automatic budget (the budget exists to stop *unsupervised* loops, not to refuse a
user action) but still cannot create concurrency, because
`attemptProvisioning` returns early while a request is in flight.

### 3.8 Reload while provisioning is pending or failed

A reload is a new provider with `provisioning = { pending, attempts: 0 }` and no
memory of the previous failure. The first session resolution starts a fresh attempt.
**A previously failed provisioning therefore recovers on reload by construction** —
there is no persisted failure flag to clear. Proven by *"retries provisioning on a
fresh mount after a previous failure"*.

### 3.9 Multiple auth events for the same user

Supabase emits `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED` and
`USER_UPDATED` for what a user experiences as one sign-in. Three guards, in order:

1. `identityChanged` false for the same uid → provisioning state is **not** reset.
2. `provisioningRef.current.status === "ready"` → no second attempt.
3. `shouldAttemptAutomatically(state, lastAttemptAt, now)` → cooldown and budget.
4. `inFlight.current` → at most one request at a time.

Proven: three extra events mid-flight still produce **one** request; later
`TOKEN_REFRESHED`/`SIGNED_IN` events after `ready` produce none; ten events during
an outage produce at most two.

### 3.10 Race conditions and risks found

| # | Risk | Status |
| --- | --- | --- |
| R1 | **Provisioning failure was indistinguishable from no state** — no reason, no retry, reload-only recovery. | **Fixed** (this phase). |
| R2 | A slow attempt from a *previous* identity could write state for the current one. | **Fixed** — `if (lastUid.current !== uid) return` after the await. |
| R3 | Logout mid-flight: the request could land after `setUser(null)`. | **Fixed** — `resetProvisioning()` aborts the controller; the uid check also rejects it. |
| R4 | Attempt budget could be inherited by the next account on a shared device. | **Fixed** — reset on every identity change and on logout. |
| R5 | `Login.tsx` still calls provisioning itself, in parallel with the auth event. | **Open, documented** — F1 above; idempotent but duplicated. |
| R6 | A 401 from one route could be mistaken for a dead session. | **Fixed** — mapped to `failed/unauthenticated`; never a sign-out. |
| R7 | Auto-retry could hammer Neon during an outage. | **Fixed** — budget of 2 + 5 s cooldown, proven bounded over 100 events. |
| R8 | Demo mode would 401 on every provisioning call. | **Fixed** — short-circuits to `ready`; the mock owns its profiles. |

**No loading-state deadlock found.** Every exit path from `attemptProvisioning`
records a terminal state, `setLoading(false)` runs before any await, and a test
asserts the app is never left in `loading`.

## §4. Recoverable provisioning — implementation

### The state machine (`src/lib/provisioning-state.ts`)

Pure, no React, no fetch — so the policy is testable without a DOM and the provider
stays an adapter.

| State | Meaning |
| --- | --- |
| `loading: true` | Session not resolved. |
| `user: null, loading: false` | Unauthenticated. |
| `user, provisioning: pending` | Signed in, profile not confirmed yet. |
| `user, provisioning: ready` | Signed in, profile exists. |
| `user, provisioning: failed { reason }` | Signed in, profile absent, **recoverable**. |

`reason` is `unavailable \| unauthenticated \| error` — coarse on purpose. The server
already refuses to leak driver text (2B.3 §8); the client needs only enough to
decide whether to offer a retry.

### Requirements, one by one

| # | Requirement | Where |
| --- | --- | --- |
| 1 | Valid session not invalidated by a Neon fault | `acceptSession` sets `user` before provisioning; the failure branch never calls `setUser(null)` |
| 2 | Never auto sign-out on failure | No sign-out path exists in the failure branches; asserted by two tests |
| 3 | No re-login to retry | `retryProvisioning()` in the notice |
| 4 | No raw errors/credentials to client | Server returns opaque bodies; `provisioningMessage` is asserted against `/postgres\|neon\|sql\|503\|500\|database/` |
| 5 | Idempotent | `on conflict do nothing returning` (2B.3), unchanged |
| 6 | No concurrent duplicates | `inFlight` controller + state guards |
| 7 | Controlled retry | Manual button; `MAX_AUTOMATIC_ATTEMPTS = 2`, `RETRY_COOLDOWN_MS = 5000` |
| 8 | Reload recovers | No persisted failure flag; fresh mount starts `pending` |
| 9 | No infinite loops | Budget proven bounded over a 100-event stream |
| 10 | Existing behaviour preserved | 296/296 tests pass, including all Phase 1 auth/logout suites |

### UI

`ProfileProvisioningNotice` reuses the design-system `Alert` + `Button` and is
mounted exactly where the existing demo-mode notice sits inside `<main>`, above
`<Breadcrumbs />`. It renders **only** for `failed` — not `pending`, because a brief
wait is not a problem to report and a flicker during normal sign-in would be worse
than silence. No screen was redesigned and no new visual language was introduced.

### What is deliberately *not* gated

`AuthGate` continues to gate on `user` alone. A profile row is required by
username/bio/reputation surfaces, but almost the whole application does not need one,
and blocking it would turn a transient database fault into a total outage. Components
that genuinely need a profile already tolerate `profile == null` — `AppLayout`
renders "Loading work status…" and falls back to `user_metadata` for the avatar
initial; `Profile.tsx` falls back to `targetIdentifier`. Those fallbacks are what
make the partial state coherent rather than a broken screen, and no change was needed.

### A note on not over-reaching

`AuthGate` is unchanged. Widening it to `user && isProvisioned` would have satisfied a
naive reading of "gate profile-dependent UI" while breaking every page that works
fine without a profile — the opposite of requirement 10. `isProvisioned` is exposed
for the few components that genuinely need it.

## §5. Profile ownership matrix

Derived from `src/server/db/schema/identity.ts`, every `from("profiles")` call site,
and the provisioning code. "Neon today" reflects the fact that **reads have not been
migrated** — see §6.

| Field | Stored today | Readers (actual) | Writers (actual) | Owner | Needed at provisioning | Migration concern |
| --- | --- | --- | --- | --- | --- | --- |
| `uid` | Supabase `auth.users.id`; `profiles.uid` PK | every profile query; `posts.ts`, `reports.ts` | provisioning insert only | **Supabase Auth** | **Yes** (the join key) | None — same UUID, no second ID |
| `username` | `profiles.username` + `usernames` registry | `AppLayout`, `Profile`, `Search`, `getUserProfile`, ~20 joins | `claimUsername` (server), provisioning | **Neon** | **Yes** (NOT NULL) | Denormalised twice; both must move in one transaction |
| `displayName` | `profiles.displayName` | `AppLayout`, `Profile`, post cards | `Onboarding`, `Settings` | **Neon** | No (nullable) | Seeded from Auth metadata at creation only |
| `initial` | `profiles.initial` | `AppLayout` avatar | `Onboarding` (`charAt(0)`), provisioning | **Neon** | No | Derivable; stored for cheap render |
| `email` | **Not in Neon at all** | `Settings.tsx` (read-only), `AppLayout` initial fallback | never written | **Supabase Auth** | **No** | Must never be copied into Neon |
| `avatarUrl` | `profiles.avatarUrl` | `AppLayout`, `Profile`, `Search` | `updateUserAvatar` | **Neon** (the *reference*) | No | See below — the file is not Neon's |
| avatar **file** | Supabase Storage `avatars/<uid>/…` | `getPublicUrl` | `uploadImage` (own-folder policy) | **Supabase Storage** | No | URL is a pointer; ownership of the object is Storage's |
| `bio` | `profiles.bio` DEFAULT `''` | `Profile`, `Search` | `Onboarding`, `Settings`, `Profile` | **Neon** | No | `''` means "not set" in the UI |
| `location` | `profiles.location` DEFAULT `''` | `Profile` | `Onboarding`, `Settings` | **Neon** | No | — |
| `website` | `profiles.website` DEFAULT `''` | `Profile` | `Onboarding`, `Settings` | **Neon** | No | No social-link fields exist; not invented |
| `skills` | `profiles.skills text[]` DEFAULT `{}` | `Profile`, `Search` | `Onboarding` | **Neon** | No | Array, not join table — no normalisation here |
| `status` | `profiles.status` DEFAULT `'Available'` | `AppLayout` ("open to work") | `AppLayout` toggle, `Settings`, `Onboarding` | **Neon** | No | CHECK allows 2 values; UI writes both |
| `isVerifiedPro` | `profiles.isVerifiedPro` DEFAULT false | `VerifiedBadge` | **never written by any code** | **Neon, admin-only** | **No — must not be set** | Badge is inert until an admin flow exists |
| `role` | `profiles.role` DEFAULT `'member'` | `posts.ts` (`can_view_post` mirror), `reports.ts` | **never written by any code** | **Neon, admin-only** | **No — must not be set** | Defaults guarantee no escalation; see §8 |
| `reputation` | `profiles.reputation` DEFAULT 0 | leaderboard, `LiveReputation` | `calculateReputation` | **Neon** (derived) | No | Derived from posts+comments scores; cross-domain |
| `followers` / `following` | `profiles.*` DEFAULT 0 | `Profile` | `toggleFollow` via RPC | **Neon** (derived) | No | Counter drift is a known 2A risk; RPCs must be ported with `follows` |
| `hasSeenVeteranCelebration` | `profiles.*` DEFAULT false | `VeteranCelebration` | `VeteranCelebration` | **Neon** | No | Pure UI state; lowest-risk field to move first |
| `createdAt` / `updatedAt` | `profiles.*` DEFAULT `now()` | not read by UI | provisioning, claim | **Neon** | Default | — |
| `favoriteTopics` | **does not exist** | — | — | — | — | In the TS type only; never read or written. Confirmed again this phase. |
| `communitiesList` | **dropped in 2B.2** | — | — | — | — | Dead duplicate of `community_members`; deliberately not carried. Confirmed again. |
| `savedPosts` | not in `profiles`; separate `saved_posts` table | `Profile` | `toggleBookmark` | **Neon** (future) | No | A different domain; out of scope |

**Ownership summary.** Supabase Auth owns `uid` and `email` and nothing else in this
table. Neon owns every application field, of which `username` is the only one a
profile cannot exist without. Supabase Storage owns the avatar *object*; Neon owns
only the URL that points at it — the matrix keeps those separate because "owns a
reference to a file" and "owns the file" are not the same claim.

## §6. Recommended profile read/write cutover

**Not performed in this phase.** Reads of `profiles` still go to Supabase from ~18
files. The strategy, in dependency order:

1. **`hasSeenVeteranCelebration` first.** One boolean, one writer
   (`VeteranCelebration`), two readers, no joins. It exercises the whole read+write
   path on the lowest-risk field and would surface connection or provider issues
   with nothing user-visible at stake.
2. **Own-profile reads second.** Introduce `GET /api/profile/me` on the existing
   identity orchestrator (identity from `getServerSession()`, the same authorization
   model as provisioning and claiming). Switch `AppLayout` and `Settings` — the two
   components that read the *viewer's* profile — to it. This is the natural
   companion to `/api/profile/provision` and needs no new table.
3. **Public profile reads third.** `getUserProfile(identifier)` in `src/lib/users.ts`
   is the single choke point for every other read (`Profile`, `Search`, `postQueries`
   joins). Replace its body with a server call; callers do not change.
4. **Writes last, one field-group per PR.** `Settings`/`Onboarding` field groups,
   then `AppLayout.status`, then the derived counters.

Rules for the cutover:

- **One direction at a time.** Read-path and write-path PRs must not overlap. The
  brief forbids dual-read; a half-migrated field that reads Neon and writes Supabase
  is exactly dual-write with extra steps.
- **A field is migrated only when every writer of it is migrated.** `username` is the
  exception already handled: provisioning and claiming write Neon, and `Settings` now
  claims through the server (§7), so its writer set is already consistent.
- **`email` never moves.** It stays in Supabase Auth, read from the session.
- **`avatarUrl` moves with `bio`, not with the upload path.** Storage is unchanged.
- **Ordering constraint:** `reputation`, `followers`, `following` cannot move before
  posts, votes, comments and follows, because they are derived from them. Do not
  start there.
- **`role` and `isVerifiedPro` move with the *authorization* layer, not with
  profiles.** They are read by `can_view_post` (§8) — migrating them without that
  function is how a visibility bug gets introduced.

## §7. Username claiming — state after 2B.3 (re-verified, not assumed)

`Settings.tsx` now calls `claimUsernameOnServer(username)`; neither it nor any other
file passes a uid. `claimUsername` and `ensureUserProfile` in `src/lib/users.ts` are
marked `@deprecated` and have **no callers** (re-verified by grep this phase). The
atomic claim path is unchanged from 2B.3 and its 11 local-PostgreSQL tests still pass,
including the 12-way concurrent contention test.

One consequence worth stating for the cutover: because `Settings` claims through
**Neon** while still saving `displayName`/`bio` through **Supabase**, a single "Save"
action currently writes to both databases. That is transitional, not dual-write in
the architectural sense (no field is written to both), but it is the strongest
argument for doing §6.2 early.

## §8. `can_view_post` authorization baseline

Source of truth: `supabase_post_settings_and_storage_migration.sql:23-49`
(`security definer`, `stable`, `set search_path = public`), mirrored in
`src/lib/posts.ts:117-128` (`canViewPost`) and `src/lib/mockSupabase.ts:1285`.

### Semantics, exactly as implemented

```
public                                        → true
auth.uid() is null                            → false
post."authorUid" = auth.uid()                 → true
profiles.role ∈ {admin, moderator}            → true
visibility = 'members'
  and communitySlug is not null
  and exists community_members(communitySlug, userId = auth.uid())
                                              → true
visibility = 'admins'
  and communitySlug is not null
  and exists communities(slug = communitySlug, ownerId = auth.uid())
                                              → true
otherwise                                     → false
```

Order matters: `public` wins before the null check, so an anonymous visitor sees
public posts. Author and staff are checked before membership, so staff see private
posts without joining.

### What must hold when content moves to Neon

1. **The predicate is evaluated server-side, always.** Neon does not inherit RLS;
   there is no second enforcement layer to catch a mistake. This is the single
   largest risk in the content migration.
2. **`auth.uid()` becomes a parameter, never an input.** It must come from
   `getServerSession()` — the same rule as provisioning. A `uid` accepted from a
   request body would make every rule below forgeable.
3. **The three lookups stay correlated to the caller.** `profiles.role`,
   `community_members`, `communities.ownerId` are the authorization inputs. If any is
   read for a caller-supplied uid, the visibility model collapses.
4. **Missing context must fail closed, loudly.** `getPostViewer` already throws rather
   than returning empty on a failed lookup ("a failed membership lookup must not make
   private posts vanish silently"). Preserve that: a DB error must not read as
   "no posts".
5. **`visibility` has no DB constraint today.** It is `text` with an app-side default
   of `public`. A `CHECK` should be added with the schema, and the fallback branch
   (`else false`) must be preserved for unknown values — an unrecognised visibility
   must deny, not default to public.
6. **Staff check is on `role`, which nothing writes.** Safe by default, but the admin
   flow that eventually writes `role` becomes an authorization-changing operation and
   needs its own review.
7. **`auth.uid()`-null parity.** Anonymous reads must be tested explicitly; the
   ordering above is the only reason public content works without a session.

### Required test matrix before content reads migrate

| # | Case | Expected |
| --- | --- | --- |
| 1 | Anonymous, `public` | visible |
| 2 | Anonymous, `members` | denied |
| 3 | Anonymous, `admins` | denied |
| 4 | Author, own `members`/`admins` | visible |
| 5 | Admin, any visibility | visible |
| 6 | Moderator, any visibility | visible |
| 7 | Member of the community, `members` | visible |
| 8 | Non-member, `members` | denied |
| 9 | Community owner, `admins` | visible |
| 10 | Community *member but not owner*, `admins` | denied |
| 11 | Logged-in, `members`, `communitySlug` null | denied |
| 12 | Unknown `visibility` value | denied |
| 13 | `community_members` lookup fails | error surfaced, **not** empty feed |
| 14 | `profiles` lookup fails | error surfaced, **not** defaulted to `member` |
| 15 | Deleted post (`isDeleted`) | excluded, independent of visibility |
| 16 | Mirrored predicate: SQL result = `canViewPost` result | identical for all rows above |

Cases 13–14 are the ones most likely to be dropped in a port and are the ones that
turn a database blip into a data leak or a silent blackout. Case 16 is the guard
against the mirror and the server drifting apart.

## §9. Tests — exact results

All new tests are **mocked or jsdom**; the database suite is **local PostgreSQL**.
No test in this phase ran against Neon.

| File | Environment | Tests | Result |
| --- | --- | --- | --- |
| `src/test/phase2b.4-provisioning-state.test.ts` | **pure unit**, no DOM/network/DB | 18 | **18 passed** |
| `src/test/phase2b.4-provisioning-recovery.test.tsx` | **jsdom**, Supabase + provisioning mocked | 17 | **17 passed** |
| `src/test/phase2b.4-gate-and-notice.test.tsx` | **jsdom**, auth context mocked | 10 | **10 passed** |
| `tests/db/*` (2B.2 + 2B.3, unchanged) | **local PostgreSQL 18.6** | 74 | **71 passed, 3 skipped** (TLS fixture absent) |

Coverage against the brief's required list:

| Required case | Where | Environment |
| --- | --- | --- |
| Auth succeeds + provisioning succeeds | recovery: *"publishes the session and reaches ready"* | jsdom |
| Auth succeeds + provisioning fails | recovery: *"stays signed in when the database is unavailable"* | jsdom |
| Failure does not sign out | recovery: *"does not sign the user out on failure"*, *"a 401 … does not end the session"*; gate: *"does not redirect to login"* | jsdom |
| Retry succeeds after temporary failure | recovery: *"succeeds after a temporary failure"* | jsdom |
| Repeated events do not duplicate | recovery: *"does not re-provision an already-ready user"*, *"does not start a second request while one is in flight"* | jsdom |
| Concurrent provisioning safe | recovery (de-dup) **+** `tests/db/identity-integration`: 8 concurrent first-time provisions → exactly 1 `created` | jsdom + **local PG** |
| Existing profile idempotent | `tests/db/identity-integration`: *"creates a profile once and is idempotent afterwards"* | **local PG** |
| Reload recovers failed state | recovery: *"retries provisioning on a fresh mount after a previous failure"* | jsdom |
| Logout clears client state | recovery: *"clears the user, the cache and the provisioning state"* | jsdom |
| Failure ≠ unauthenticated | gate: *"renders the protected subtree"*, *"does not redirect to login"*; state: *"a 401 … is a recoverable failure, not a logout"* | jsdom |
| Bounded retry / no loops | state: *"is bounded: the number of automatic attempts is finite"* (100 events → 2 attempts) | pure unit |

## §10. Checks run

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `tsc --noEmit -p tsconfig.json` | **0 errors** |
| ESLint | `eslint .` | **0 errors**, 6 pre-existing warnings (`layout.tsx`, `navigation.tsx`, untouched) |
| Vitest (unit) | `npm test` | **26 files, 296/296 passed** |
| DB integration | `npm run test:db` (local PG 18.6) | **71 passed, 3 skipped** |
| Next.js build | `npm run build:next` | see §10.1 |
| Vite build | `npm run build` | see §10.1 |

### 10.1 Build and regression notes

- One existing test failed during development:
  `phase1.1-session-architecture` asserts that every `supabase.auth.getSession(`
  reader is a known module. Reformatting the call onto its own line in
  `useAuth.tsx` put the dot on a different line and the regex stopped matching.
  **The test was not weakened** — the call was restored to a single expression, with
  a comment explaining why it must stay that way. 14/14 pass.
- No test was modified to accommodate the new behaviour; `phase01-logout` (7 tests)
  passed unchanged, which is the main evidence that logout behaviour was preserved.
- 296/296 is the pre-existing 251 plus the 45 new tests.

## §11. Limitations

1. **No real-Neon verification.** Unchanged from 2B.3, and the reason §10's DB
   results say "local PostgreSQL" everywhere.
2. **F1 — duplicated provisioning on password login.** `Login.tsx` calls
   provisioning itself while the auth event does the same. Idempotent, so harmless to
   data, but it is a second request the provider does not own. Removing it is a login
   latency change and belongs in the cutover.
3. **`Settings` save straddles both databases** — username to Neon, profile fields to
   Supabase, in one user action (§6.2 is the fix).
4. **jsdom is not a browser.** Provider logic is proven; real cookie persistence, token
   refresh timing and Supabase's actual multi-event sequence are not.
5. **`role` / `isVerifiedPro` have no writer.** Authorization is safe by default; the
   admin flow that will write them does not exist and will need its own review.
6. **No notice for `pending`.** A slow provisioning call shows nothing until it fails.
   Deliberate — but if provisioning ever becomes slow rather than fast-failing, a
   skeleton state may be warranted.

## §12. Neon-specific checks still pending

| Check | Status |
| --- | --- |
| Pooled runtime connection | **PENDING** — no credentials |
| Direct migration connection | **PENDING** |
| Live TLS handshake, runtime path | **PENDING** |
| Live TLS handshake, Drizzle Kit path (separate code path) | **PENDING** |
| Pooling behaviour under concurrency | **PENDING** |
| Advisory-lock contention | **PENDING** |
| Failed-migration atomicity | **PENDING** |
| Provisioning/claiming under Neon latency | **PENDING** — jsdom uses instant mocks, so the retry/cooldown path has not been exercised against real latency |

The last row is new in this phase and worth flagging: the 5 s cooldown and 2-attempt
budget were chosen against mocked latency. Real Neon latency (pooled, cold start) may
make `RETRY_COOLDOWN_MS` too short or the budget too small. Both are single constants
in `provisioning-state.ts` with tests that pin the *policy* rather than the values, so
tuning them after a real measurement is a one-line change.

## §13. `main` unmodified — confirmation

`main` is at **`1d18864`**, unchanged from the start of the session. No commit, merge
or push touched it. All work is on `arena/178f33c3-freelancer-s-hub`. **No pull
request was opened or merged.**

---

### Scope confirmation

No profile reads migrated. No dual-read or dual-write. No posts/comments/votes/polls/
attachments/leads/notifications migration. No Supabase Auth provider change. No
Storage migration. No seed users. No new tables. No screen redesign. `can_view_post`
documented only, not modified. No ZIP-derived feature implemented.

**Phase 2B.4 stops here.**
