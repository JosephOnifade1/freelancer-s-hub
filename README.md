# Borynx - Freelancer Community Platform

Borynx is a modern community platform built with React, TypeScript, Tailwind CSS, and powered by **Supabase** for database, real-time features, and authentication.

---

## 🚀 Setting Up Supabase Backend

### 1. Create a Supabase Project
1. Head over to [Supabase](https://supabase.com) and create a new project.
2. Go to **Project Settings > API** and copy your **Project URL** and **anon / public key**.

### 2. Configure Environment Variables
Create a `.env.local` or `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Apply Database Schema
1. In your Supabase Dashboard, open the **SQL Editor**.
2. Copy the entire contents of `supabase_schema.sql` from the root of this project.
3. Paste it into the SQL Editor and click **Run**.

This script automatically sets up:
- **Tables**: `profiles`, `usernames`, `communities`, `posts`, `comments`, `leads`, `community_members`, `saved_posts`, `follows`, and `votes`.
- **Foreign Keys**: Named relationships for PostgREST joins (`posts_authorUid_fkey`, `comments_authorUid_fkey`, `leads_postedByUid_fkey`).
- **Row Level Security (RLS)**: Owner-scoped policies. Post/comment counters and reputation are maintained by server-owned RPCs and triggers — there is deliberately no general-purpose counter-update policy on `posts`/`comments`.
- **Triggers**: Automatic profile creation on auth signup via `handle_new_user()`, plus transactional active-comment counts on insert/delete/restore.
- **RPC Functions**: `cast_vote` (atomic, hardened voting: the server derives the author, checks visibility/deleted/self-vote rules, locks concurrent votes, and computes score/reputation deltas), view counts, and follow/member counters. Comment counts are maintained by the `trg_post_comment_count` trigger.
- **Initial Seed Data**: Pre-populated communities for instant operation.

> **Upgrading an existing database** created with an older schema? Run the
> migrations once, in this order, in the SQL Editor:
> 1. `supabase_architecture_hardening.sql` — drops the old permissive counter
>    policies, installs `cast_vote`, removes the obsolete
>    `apply_vote_aggregate` helper (which trusted caller-supplied score deltas).
> 2. `supabase_lead_applications_migration.sql` — real lead applications.
> 3. `supabase_notifications_migration.sql` — trigger-generated notifications.
> 4. `supabase_reports_and_moderation_migration.sql` — reports, roles, Verified Pro.
> 5. `supabase_auth_completion_migration.sql` — signup usernames honored by
>    `handle_new_user()`; also lists the Auth dashboard settings (confirm
>    email, site URL, redirect allow list incl. `/reset-password`) to set.
> 6. `supabase_post_settings_and_storage_migration.sql` — enforces post
>    visibility / allowComments / pinning via RLS (`can_view_post`) and
>    creates the `avatars` + `post-images` Storage buckets.
> 7. `supabase_post_interaction_hardening_migration.sql` — hardens
>    `cast_vote` (visibility/deleted/self-vote checks, concurrency lock),
>    moves `posts.commentCount` maintenance into a database trigger, and
>    blocks comments on deleted posts / cross-post reply parents.
> 8. `supabase_ux_marketplace_pipeline_documents_migration.sql` — adds the
>    account-private pipeline table, the `post_documents` table, the
>    `post-documents` Storage bucket with RLS, and a security-definer trigger
>    that enforces object existence and the three-document upload limit.
> 9. `supabase_achievements_badges_migration.sql` — adds the `badges` catalog
>    table, the `user_badges` earned-badges table with RLS, and seeds the
>    default badge catalog (First Post, Rising Voice, Helper, Trusted Voice,
>    Consistent, Generous, Veteran, Conversation Starter).
>
> Apply migration 7 **before** deploying the updated frontend. Its backfill
> reconciles all existing comment counts and briefly locks post/comment writes
> while installing the trigger. Older browser tabs may log an error from the
> retired `increment_comment_count` RPC; comment inserts still succeed and
> the trigger maintains the count. This repository does not automatically
> execute migrations against an existing hosted project.
>
> **`supabase_ux_marketplace_pipeline_documents_migration.sql` (step 8) is unapplied.** The `/pipeline` page, private document upload/signed download, and account-scoped post drafts require its tables and Storage bucket. Do not deploy frontend code that depends on those tables until this migration has been applied and approved separately.

---

## 🛠️ Features

- **Post Settings, Enforced**: Post visibility (`public` / `members` / `admins`), comment on/off, and space pinning are enforced by database RLS (`can_view_post`) — not just hidden in the UI — and mirrored in the feed, search, and demo mode. Images (avatars, post images) upload to Supabase Storage buckets (`avatars`, `post-images`, own-folder write policies) instead of being stored as base64 in the database.
- **Authentication**: Email/Password and Google OAuth sign-in via Supabase Auth — with chosen @usernames at signup (live availability check), email confirmation + resend, forgot/reset-password flow (`/forgot-password` → email link → `/reset-password`), return-to-page after login, and a first-run profile setup at `/onboarding` (plus a "complete your profile" prompt on the feed until your bio and skills are filled in).
- **Feed & Discussions**: Post creation, voting, rich text markdown editing, and commenting threads.
- **Communities**: Join/leave specialized freelancer communities (Design, Dev, Marketing, Writing, etc.).
- **Job Board (Leads)**: Post and discover freelance bounties, project leads, and retainer gigs. Applications are real: proposals are stored in `lead_applications`, lead owners review them in the **Applications** inbox (`/applications`), and applicant counts are maintained by database trigger. (Existing databases: run `supabase_lead_applications_migration.sql` once.)
- **Account-Private Pipeline & Documents**: Save opportunities to a private pipeline (`/pipeline`, backend-persisted per account), upload private post documents to a dedicated Storage bucket with signed download and per-author removal, and restore account-scoped post drafts in the composer. Requires `supabase_ux_marketplace_pipeline_documents_migration.sql` (step 8), which is **unapplied**.
- **Profiles & Reputation**: Custom handles, bios, skills, avatar uploads, and reputation tracking.
- **Notifications**: In-app notifications (bell + `/notifications`) for comments, replies, upvotes, follows, and lead-application events. Rows are generated by database triggers — run `supabase_notifications_migration.sql` once on existing databases.
- **Trust & Moderation**: Real [Privacy Policy](/privacy) and [Terms of Service](/terms); persisted content reports (posts, leads) reviewed by moderators at `/admin`, who can remove content, grant/revoke Verified Pro (eligible at 1,000 reputation + admin review), and — admins only — assign roles. Existing databases: run `supabase_reports_and_moderation_migration.sql` once, then promote your first admin with `update public.profiles set "role" = 'admin' where "username" = 'your_handle';`
- **Badges & Achievements**: Earnable badges (First Post, Rising Voice, Helper, Trusted Voice, Consistent, Generous, Veteran, Conversation Starter) tracked at `/achievements` with reputation breakdown, streak tracking, celebration toasts on unlock, and badge display on public profiles. Run `supabase_achievements_badges_migration.sql` to persist badges server-side; without it, progress is computed client-side.
- **Leaderboard**: `/leaderboard` ranks top contributors by reputation, posts, or streak.
- **Demo Mode**: Set `VITE_DEMO_MODE=true` to run on a seeded mock database stored in the browser's localStorage (data is not shared between users or devices). Without credentials and without demo mode, the app fails visibly instead of silently pretending demo data is real.

---

## 🧪 Local Development

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

### Next.js 16 App Router (migration track)

Two front ends live side by side on this branch: the original **Vite + React
Router** app (default scripts, full rollback) and the **Next.js 16 App Router**
migration track.

| Script | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm run preview` | Vite app (port 8080) — the fallback |
| `npm run dev:next` | `next dev --turbopack -H 0.0.0.0 -p 3000` |
| `npm run build:next` / `npm run start:next` | Next 16 production build (Turbopack) |
| `npm run build:next:webpack` / `npm run dev:next:webpack` | Webpack escape hatch for the Next build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config; `next lint` no longer exists in Next 16) |
| `npm test` | Vitest suite |
| `node scripts/server-smoke.mjs` | Route/asset/style smoke checks against a running Next server |

### Route parity

Both front ends must serve the same URLs. `src/lib/route-parity.ts` is the
inventory, and `src/test/phase02-interaction.test.tsx` fails if `src/app` gains or
loses a page without updating it. Redirect-only aliases (`/b`, `/p`, `/f`, `/u`,
`/following`) exist on both sides.

Next.js 16 uses Turbopack by default, so the React Router compatibility alias is
declared twice in `next.config.mjs` (`turbopack.resolveAlias` and `webpack`).
`src/lib/navigation.tsx` keeps every existing `react-router-dom` import working
under Next — components are unchanged. Under Next, set `NEXT_PUBLIC_SUPABASE_URL`
/ `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_DEMO_MODE`; the Supabase client
reads both the `VITE_*` and `NEXT_PUBLIC_*` names.

See `docs/PHASE_0.1_NEXT16_COMPATIBILITY_AUDIT.md` and
`docs/PHASE_0.1_COMPLETION_REPORT.md` for the upgrade record.
