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
- **Row Level Security (RLS)**: Security policies for authenticated user data safety.
- **Triggers**: Automatic profile creation on auth signup via `handle_new_user()`.
- **RPC Functions**: High-performance functions for view counts, voting, member counts, and reputation increments.
- **Initial Seed Data**: Pre-populated communities for instant operation.

---

## 🛠️ Features

- **Authentication**: Email/Password and Google OAuth sign-in via Supabase Auth.
- **Feed & Discussions**: Post creation, voting, rich text markdown editing, and commenting threads.
- **Communities**: Join/leave specialized freelancer communities (Design, Dev, Marketing, Writing, etc.).
- **Job Board (Leads)**: Post and discover freelance bounties, project leads, and retainer gigs.
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
