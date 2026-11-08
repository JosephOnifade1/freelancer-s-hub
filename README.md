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
- **Row Level Security (RLS)**: Owner-scoped policies. Post/comment counters and reputation are **only** writable through SECURITY DEFINER RPCs — there is deliberately no general-purpose update policy on `posts`/`comments`.
- **Triggers**: Automatic profile creation on auth signup via `handle_new_user()`.
- **RPC Functions**: `cast_vote` (atomic voting: the server derives the author and computes score/reputation deltas), view counts, comment counts, follow/member counters.
- **Initial Seed Data**: Pre-populated communities for instant operation.

> **Upgrading an existing database** created with an older schema? Run
> `supabase_architecture_hardening.sql` once in the SQL Editor instead. It
> drops the old permissive counter policies, installs `cast_vote`, and removes
> the obsolete `apply_vote_aggregate` helper (which trusted caller-supplied
> score deltas). The remaining `supabase_*_migration.sql` files are one-off
> data/settings migrations — apply any you haven't yet, in filename order.

---

## 🛠️ Features

- **Authentication**: Email/Password and Google OAuth sign-in via Supabase Auth.
- **Feed & Discussions**: Post creation, voting, rich text markdown editing, and commenting threads.
- **Communities**: Join/leave specialized freelancer communities (Design, Dev, Marketing, Writing, etc.).
- **Job Board (Leads)**: Post and discover freelance bounties, project leads, and retainer gigs. Applications are real: proposals are stored in `lead_applications`, lead owners review them in the **Applications** inbox (`/applications`), and applicant counts are maintained by database trigger. (Existing databases: run `supabase_lead_applications_migration.sql` once.)
- **Profiles & Reputation**: Custom handles, bios, skills, avatar uploads, and reputation tracking.
- **Local Fallback Mode**: Automatically falls back to a mock database if Supabase credentials are missing, ensuring instant preview availability.

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
