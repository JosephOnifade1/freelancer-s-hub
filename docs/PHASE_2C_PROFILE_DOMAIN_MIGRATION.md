# Phase 2C — Profile Domain Migration

> **Verification status.** No real-Neon connection was made in this phase. Arena has no
> database credentials, per the standing rule from 2B.3/2B.4, so every database result
> below is **local PostgreSQL 18.6**, described as such. Mocked and jsdom tests are
> labelled as such. Nothing here claims Neon-specific behaviour was verified — see §9.

---

## §1. Branch and starting commit

| Item | Value |
| --- | --- |
| Branch | `arena/7b7d5f27-freelancer-s-hub` |
| Starting commit | `a6d8f1a98f829bd5c3763f25856c812371a444a7` (merge of PR #28, 2B.4) |
| Base | `migration/nextjs-app-router` |
| `main` | **`1d18864`, untouched** — see §10 |
| Tree at start | clean |

No reset, clean or regeneration. No branch switch. No PR opened or merged.

## §2. What this phase set out to do

2B.4 §6 deferred the profile cutover and listed six preconditions. 2C is the execution of
that cutover, for **profiles only**. The deliverable list, and where each is discharged:

| Requirement | Where |
| --- | --- |
| Remove duplicate profile provisioning | §3 |
| Migrate profile reads Supabase → Neon | §4 |
| Migrate profile writes and username management | §5 |
| Fix settings save consistency | §5.3 |
| Preserve Supabase Auth and Storage | §6 |
| Update affected UI and server-side authorization | §6, §7 |
| Remove obsolete profile database access | §3, §4 |
| Comprehensive regression and integration tests | §8 |
| Document what needs real-Neon verification | §9 |

## §3. Duplicate provisioning — removed

Before this phase there were **two** independent paths that could create a profile row:
`AuthProvider`'s provisioning effect (2B.4) and, on the login and signup screens, an
explicit `provisionProfileOnServer()` call. Both were idempotent, so the duplication was
not a correctness bug in the happy path — but it was two mechanisms where the design
calls for one, and it doubled the request count on every sign-in.

Removed from `src/views/Login.tsx` (two sites, including the demo-login path) and
`src/views/Signup.tsx` (two sites). `AuthProvider` remains the sole owner.

A static guard now enforces the property, because it is otherwise invisible: a future
edit could re-add a call and every behavioural test would still pass.

- `src/test/phase2c-profile-migration.test.ts` asserts `provisionProfileOnServer(` appears
  only in `src/hooks/useAuth.tsx` across all of `src/`.
- The existing 2B.4 provider tests already assert `provisionCalls === 1` after repeated
  and concurrent auth events; those now describe the only remaining mechanism rather than
  one of two.

## §4. Profile reads — Neon

`src/server/features/profile/profile-queries.ts` is the whole read surface, and
`src/server/features/profile/index.ts` is the `server-only` orchestrator. Every read
flows: route handler → orchestrator (session + configuration) → query → Neon.

### 4.1 The projection split

Two column lists, and the difference between them is the authorization boundary:

| List | Fields | Served by |
| --- | --- | --- |
| `PUBLIC_COLUMNS` | `uid, username, displayName, initial, bio, location, website, status, skills, reputation, followers, following, avatarUrl, isVerifiedPro, createdAt` | any route, authenticated or not |
| `OWN_COLUMNS` | the public list **plus `role`, `hasSeenVeteranCelebration`, `updatedAt`** | only the caller's own row, and the staff-gated moderation list |

`role` is the only *privileged* field that differs; the other two additions are UI state
(the veteran-ceremony flag) and a bookkeeping timestamp, neither of which reveals anything
about the account. `role` is never in a response body outside
`/api/profiles/moderation` for other users, and never in `/api/profile/me`'s sibling
public routes. This is asserted statically rather than trusted: the migration test
parses every `select … from profiles` in the query module and fails if a projection it
does not recognise appears, or if `role` appears in anything other than `OWN_COLUMNS` or
the moderation projection.

`email` is not a Neon column and is never selected; Supabase Auth owns it. Also asserted.

### 4.2 `joined` is derived, not stored

Supabase had a `profiles.joined text` column holding a year. 2B.2 dropped it — it was
denormalised from `createdAt` and could disagree with it. `Profile.tsx` still rendered
`profile.joined` at two sites, so the schema change left a field the UI read and nothing
wrote.

Resolved by deriving: `joinedYear(createdAt)` returns the four-digit year, and
`UserProfile.joined` is now computed at the projection boundary. No migration, no second
source of truth, no UI redesign — the rendered output is identical.

### 4.3 The read that no longer creates

The old `getUserProfile` called `ensureUserProfile` and could **create a profile row as a
side effect of a read**. That made `GET /api/profiles/[identifier]` a write endpoint and
made a typo'd handle capable of provisioning an account.

`GET` is now strictly read-only. A missing row returns `404` with reason
`profile_missing`, and creation belongs solely to the idempotent provisioning route. This
is a deliberate behavioural change: a caller that relied on the read to provision must
now provision explicitly. Nothing in `src/` does — verified by grep in §3.

### 4.4 `PUBLIC` reads and the multi-uid batch

`findProfilesByUids` enriches many profiles in one round trip (reporter names on the
moderation screen, author previews). **The integration test found a real production bug
here** — see §8.2.

### 4.5 Moderation reads

`findModerationProfiles` is the only query that selects `role` for *other* users. The
authorization check lives in `getModerationProfiles` in `index.ts`, beside the query, not
in the route — so a second caller cannot forget it. The route returns `403` for both
"no profile" and "not staff", deliberately indistinguishable so it cannot be used to
enumerate staff. `401` is still returned for the genuinely unauthenticated case, because
the client needs to know whether to redirect to login; an anonymous visitor therefore
learns only "not staff", which is not information.

## §5. Profile writes and username management — Neon

### 5.1 Identity is never client-supplied

Every write resolves the subject from the **verified Supabase session** via
`getServerSession`. There is no uid parameter on any write function — the arity *is* the
security property, and `profile-services.test.ts` asserts it (`updateCurrentProfile.length
=== 1`) rather than relying on a code comment.

No write route reads a uid from a body or a query string; this is asserted statically for
all four write routes.

### 5.2 Write-shape authorization

`EditableProfileFields` is a closed interface. Only the eight user-editable fields are in
it, and `buildUpdateSet` only ever emits `set` clauses for those. A caller cannot reach
`role`, `isVerifiedPro`, or `reputation` even with a runtime-smuggled key — the smuggled
key is ignored because the builder iterates its own known field list, not the input
object's keys. Covered by a test that casts past the type and asserts none of the three
appears before the `where` clause.

`updateOwnProfile` derives `initial` from `displayName` rather than accepting it, so the
avatar initial cannot disagree with the name. Text is trimmed and bounded
(5000 chars, 50 skills, 40 per skill).

`profile_missing` is a distinct outcome from an error: the update matched no row, which
means the caller's profile has not been provisioned yet. The UI turns it into "Your
profile isn't ready yet. Please try again in a moment." rather than a generic failure.

### 5.3 Settings save consistency — the straddle, fixed

This was the 2B.4 §11 leftover. One "Save" wrote the username claim to Neon and
`displayName`/`bio`/`website`/`status` to Supabase. A failure in the second half left a
half-saved form with the handle already changed and no way for the UI to know.

Both halves now target Neon, in one `PATCH`. The claim remains a separate operation — it
must be, because it is a race against other users, not a field update — but it happens
**first** and its result is committed before the fields are sent. A failed field write
therefore leaves a coherent state (new handle, old fields) that the user can re-save.

Tested in `src/test/phase2c-settings-consistency.test.tsx` (jsdom, 6 tests): fields go to
the Neon client and not to Supabase; the claim resolves before the save
(`invocationCallOrder`); a failed save shows an error and never a "Saved" toast; the
pre-provisioning and expired-session cases get their own messages; and a lost claim race
sends **no** fields — the specific half-save this phase eliminates.

### 5.4 Username management

Unchanged from 2B.3 in mechanism — the atomic server-side claim — but now consistent with
the rest of the write path: `checkUsernameAvailability` asks Neon, checking the
`usernames` registry and `profiles.username` together, which are the two sources the
claim relies on. It returns `false` on a failed request rather than throwing, so a
network blip no longer renders as "username unavailable".

The settings field still debounces its probe and keeps Save disabled until the handle is
confirmed. That behaviour is unchanged and the new tests wait for the real state
transition rather than a timer.

### 5.5 Avatar

`setOwnAvatar` records a pointer; it does not touch Storage. The URL is validated as
`http(s)` server-side before it reaches SQL. This is the only place the check can be
enforced for every caller: a `javascript:` or `data:` URL in `avatarUrl` would be
rendered straight into `<img src>` by the client. Tested at the query layer (rejected
before the statement is built) and statically (the route contains no `supabase` or
`storage` reference).

## §6. Supabase Auth and Storage — preserved

| Concern | Owner | Changed? |
| --- | --- | --- |
| Session, tokens, OAuth, password reset, email confirmation | Supabase Auth | **No** |
| `email` | Supabase Auth | **No** — never copied to Neon |
| Avatar file bytes, bucket, policies | Supabase Storage (`src/lib/uploads.ts`) | **No** |
| Avatar URL pointer | Neon `profiles.avatarUrl` | Moved (was Supabase) |
| `community_members`, `communities`, `follows` | Supabase | **No** |
| posts, comments, votes, leads, notifications, saved posts | Supabase | **No** |

`getPostViewer` now resolves the viewer's role through `fetchOwnRole()`, in parallel with
the two Supabase community queries it already made. One behavioural change: a failed role
read now **throws** rather than silently demoting a moderator to `member`. Silently
under-granting an admin their own moderation controls is worse than an error state.

## §7. Deliberate asymmetries

These are not oversights. Each is a consequence of migrating profiles and nothing else,
and each has a defined end state.

1. **`calculateReputation` derives from Supabase, writes to Neon.** Reputation is computed
   from posts and comments, which have not migrated. Moving the derivation now would sum
   empty tables and zero every user's score. The write target is correct; the input stays
   where the data is.

2. **`toggleFollow` writes the caller's `following` in Neon and the target's `followers`
   via a Supabase RPC.** The caller's own row has migrated; the target's is a different
   user's row and `follows` is still in Supabase. Both halves must therefore be attempted
   in the same user action until `follows` migrates. The `increment_following` /
   `decrement_following` RPCs are gone; `increment_followers` /`decrement_followers`
   remain, and `adjustProfileCounter` replaces the former.

3. **`search.ts` is half-migrated by design.** The user half is Neon; the post half is
   Supabase and embeds a `profiles!` FK join for author data. Splitting it now would mean
   two round trips to produce one result page.

4. **Eight embedded `profiles!` FK joins remain** in `posts.ts`, `comments.ts`,
   `leads.ts`, `reports.ts` and `search.ts`. The `profiles` table is still physically
   present in Supabase precisely so these joins resolve. **No rows are mirrored and no
   dual-write exists** — that was the 2C decision and it stands. The end state is to
   hydrate author data from Neon at `mapPostRow`, which belongs to the content phase.

5. **`reports.ts` was migrated but is half-and-half.** Reporter names and the profile
   preview batch now come from Neon (`fetchPublicProfiles`, one batch instead of one
   Supabase query per reporter); the report rows themselves remain in Supabase. This is
   asymmetry 4 applied to the moderation screen, and the moderation *user list* is the one
   place a Neon profile read unlocks a real feature.

## §8. Tests

### 8.1 Results

| Suite | Runner | Result |
| --- | --- | --- |
| `npm test` (default, hermetic) | jsdom / node | **318 / 318** (was 296; +22) |
| `npm run test:db` (needs `DATABASE_URL`) | node | **192 passed, 3 skipped** |

Breakdown of the new database-package tests, all against **local PostgreSQL 18.6** on
`127.0.0.1:55442` (not Neon):

| File | Tests | What it proves |
| --- | --- | --- |
| `tests/db/profile-queries.test.ts` | 42 | Projections; partial update touches only supplied columns; `initial` derives from the display name; smuggled privileged keys never reach `set`; `javascript:`/`data:` avatar URLs rejected before SQL; driver errors do not leak the connection string |
| `tests/db/profile-integration.test.ts` | 20 | Real PG: constraints, `%`-escaping in search, counter clamp at 0, concurrent disjoint-field updates both survive, 10 concurrent increments = 10, moderation projection is the only one carrying `role` |
| `tests/db/profile-services.test.ts` | 23 | Session uid is always the subject; unauthenticated short-circuits before the DB; write arity 1; moderation gate refuses `member`, allows `moderator`/`admin` |
| `tests/db/profile-routes.test.ts` | 36 | Status codes and response shapes for all **eight** profile route handlers in scope (`/api/profile/me` GET+PATCH, `/api/profiles/[identifier]`, `/api/profiles/lookup`, `/api/profile/avatar`, `/api/profile/reputation`, `/api/profile/following-counter`, `/api/profiles/moderation`), including the unconfigured-database path |

New jsdom tests in the default suite:

| File | Tests | What it proves |
| --- | --- | --- |
| `src/test/phase2c-profile-migration.test.ts` | 16 | Static: no `.from("profiles")`/`.from("usernames")`; one provisioning caller; `server-only` boundary; `role`/`email` never leaked; Auth and Storage untouched |
| `src/test/phase2c-settings-consistency.test.tsx` | 6 | §5.3 |

The 3 skips are the TLS-verification tests, which require a live server with a real
certificate.

### 8.2 The bug the integration test found

`findProfilesByUids` batched with `where uid = any(${uids})`. Drizzle's `node-postgres`
binding sends a JavaScript array as a non-array parameter, so PostgreSQL rejected the
statement with `op ANY/ALL (array) requires array on right side` (SQLSTATE 42809).

The fake-DB unit test rendered the SQL happily — it never sees a real parameter binder.
**Only the real-PostgreSQL integration test could catch this**, which is the argument for
keeping the PG-backed suite alongside the hermetic one. Fixed by building an explicit
`in (…)` list with `sql.join`.

This is recorded rather than quietly fixed because the same failure mode applies to any
future batch query written in the `= any(${jsArray})` style through this driver.

### 8.3 Assertions I got wrong (and why it matters)

Three tests failed on first run because of my assertions, not the code:

- "update touches only supplied fields" and "cannot write a privileged column" both
  asserted against the whole generated statement, but `returning` legitimately names every
  column. Scoped to the substring before `where uid`. **Rule: slice at `where` before
  asserting a column is absent from an `update`.**
- The client-body check looked for `uid` anywhere in a request body. `uid` appears in
  response *types*; rewritten to assert no `JSON.stringify(...)` body contains it.
- The static migration test failed four ways on **comments documenting the removals** —
  a note saying "`ensureUserProfile` is gone" contains `ensureUserProfile`. The checker now
  strips comments before matching, so it tests code rather than prose.

No existing test was weakened to accommodate new code.

## §9. What still requires real-Neon verification

Nothing in this phase was verified against Neon. The local PostgreSQL cluster agrees on
SQL semantics, constraints and concurrency, and proves nothing about the network path,
the pooler, or Neon's TLS termination.

| Check | Status |
| --- | --- |
| Pooled vs. direct connection behaviour at runtime | **PENDING** |
| Live TLS handshake, runtime path | **PENDING** |
| Live TLS handshake, Drizzle Kit path (separate code path) | **PENDING** |
| Advisory-lock contention (username claims) under real concurrency | **PENDING** |
| Failed-migration atomicity | **PENDING** |
| Provisioning retry/cooldown tuning under real latency (5 s / 2 attempts) | **PENDING** |
| Profile query performance without RLS | **PENDING** |
| `followers`/`following` counter replacement under concurrent real follows | **PENDING** |

### 9.1 A new gap that this phase created

Moving profiles to Neon **removes the RLS policies that used to gate profile access.**
Supabase RLS applied to every query regardless of the caller; Neon has no equivalent
here, so authorization is now enforced entirely in application code — the projection
split (§4.1), the session-derived subject (§5.1), and the staff gate (§4.5).

That enforcement is tested, and the tests are static where the risk is a future omission.
But it is a different *kind* of guarantee from a database-level policy: RLS fails closed
if a developer writes a careless query; these checks fail closed only if the developer
uses the provided query functions. The projection-scanning test in
`phase2c-profile-migration.test.ts` is the mitigation — an unrecognised `select` against
`profiles` fails the build.

### 9.2 Moderation gate has no writer yet to exercise it

`role` has no writer in this codebase — `setUserRole` still calls a Supabase RPC, so every
Neon row is `member` today and `getModerationProfiles` correctly refuses everyone. The
gate is tested with injected roles and will start working when roles are written to Neon.
This is a known limitation, not a defect: the check is in place before it is needed, and
it is in the service rather than the route so no second caller can bypass it.

## §10. Checks run

| Command | Result |
| --- | --- |
| `./node_modules/.bin/tsc --noEmit` | **0 errors** |
| `npx eslint .` | **0 errors**, 6 `react-refresh` warnings (pre-existing, unrelated) |
| `npm test` | **318 / 318** |
| `npm run test:db` (local PG 18.6) | **192 passed**, 3 skipped |
| `npm run build` (Vite) | green — rollback path intact |
| `npm run build:next` | green — all profile routes registered |

### Orphan check after removal

| Check | Result |
| --- | --- |
| `.from("profiles")` / `.from("usernames")` in `src/` | **none** |
| Importers of the deleted `ensureUserProfile` / `createUserProfile` | **none** (only comments, and two test mocks that stub the old module surface) |
| `increment_following` / `decrement_following` RPC calls | **none** (replaced by the following-counter route) |
| `increment_followers` / `decrement_followers` RPC calls | **2**, both in `src/lib/users.ts`, both for the *target's* counter — asymmetry 2 |
| Embedded `profiles!` FK joins | **8**, unchanged — asymmetry 4 |

`main` is at `1d18864`, unchanged. All work is on `arena/7b7d5f27-freelancer-s-hub`. **No
pull request was opened or merged.**

---

### Scope confirmation

Profiles only. No posts/comments/votes/polls/attachments/leads/notifications movement.
No Supabase Auth provider change. No Supabase Storage migration. No seed users. No new
tables. No screen redesigns. No dual-read or dual-write. No row mirroring. Account
deletion not implemented. `main` untouched.
