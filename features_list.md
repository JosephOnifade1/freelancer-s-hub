# Freelancer's Hub: Features List

> Last updated: 2026-11-05 — Backend is **Supabase** (not Firebase). Firebase keys in `.env.local` are legacy/unused.

---

## 1. Authentication & User Management

* **Login & Signup Flows**: Email/Password via Supabase Auth. Friendly error messages for network failures ("Failed to fetch").
* **User Profiles (`/f/:handle`)**: Displays user info, reputation, achievements, posts, and follow/unfollow. Online status dot reflects `profiles.status`.
* **Online Status Toggle**: Available from the avatar dropdown menu — toggles between "Available" and "Appear Offline" and updates `profiles.status` in Supabase.
* **Settings (`/settings`)**: Manage account details and preferences.
* **Status**: ✅ **Working** — Supabase Auth + Supabase `profiles` table.

---

## 2. Feed & Post System

* **Main Feed (`/`)**: Hot/Best/New sorting. Fetches posts from Supabase.
* **New Feed (`/new`)**: Posts sorted by `createdAt` descending. Linked from sidebar.
* **Following Feed (`/following`)**: Shows posts only from users you follow. Fully routed + in sidebar.
* **Tag Feed (`/t/:tagName`)**: Filter posts by tag.
* **Create Post (`/submit`)**: Rich editor with image upload, code snippets, polls, visibility controls, community selector.
* **Save Draft**: "Save Draft" button on CreatePost saves to `localStorage`. Viewable/resumable at `/drafts`.
* **Drafts (`/drafts`)**: Lists your locally saved draft. Resume or delete from this page.
* **Post Detail (`/p/:id` or `/b/:slug/p/:id`)**: View post, comments, and vote.
* **Bookmarks (`/bookmarks`)**: Save/unsave posts. Bookmark state persisted in Supabase `saved_posts` table.
* **Voting**: Upvote/downvote on posts and comments. Updates author reputation reactively mid-session.
* **Status**: ✅ **Working** — posts, votes, and bookmarks all backed by Supabase.

---

## 3. Communities (B-Spaces)

* **Communities Directory (`/communities`)**: Directory of niche spaces. Join/Leave persisted to Supabase.
* **Community Detail (`/b/:slug`)**: Posts scoped to a specific community.
* **Create Community**: Modal available from sidebar.
* **Status**: ✅ **Working** — communities loaded from Supabase `communities` table.

---

## 4. Leads Board

* **Leads Directory (`/l`)**: Job/bounty board with Kanban and list views. Syncs remote Supabase leads into local board on load. Search + category filters.
* **Create Lead (`/l/post`)**: Form to post a new opportunity — saved to Supabase and immediately mirrored to the local board.
* **Lead Detail (`/l/:leadId`)**: Full detail view with working "Apply Now" (dialog + proposal), "Share" (clipboard), and "Report" (toast) actions.
* **Status**: ✅ **Working** — Supabase `leads` table + local Kanban state unified.

---

## 5. Gamification & Achievements

* **Achievements Dashboard (`/achievements`)**: Unlockable badges based on reputation, post count, upvotes.
* **Reputation**: Updated on vote; `VeteranCelebration` fires reactively mid-session when reputation crosses 1000.
* **Verified Pro badge**: Shown on profiles and post cards.
* **Status**: ✅ **Working**.

---

## 6. Search

* **Global Search**: Available in the top nav (Cmd/Ctrl+K). Searches posts and users from Supabase with debounce. Results shown in a dropdown with keyboard navigation.
* **Status**: ✅ **Working** — minor edge cases in routing (see `abandoned_features.md`).

---

## 7. Premium

* **Status**: ❌ **Stub** — `/premium` shows a ComingSoon page. No payment integration yet.

---

## Summary

| Area | Status |
|---|---|
| Auth (Login/Signup) | ✅ Working |
| Profiles + Online Status | ✅ Working |
| Main / New / Following / Tag Feeds | ✅ Working |
| Drafts | ✅ Working (localStorage) |
| Bookmarks | ✅ Working (Supabase) |
| Voting + Reputation | ✅ Working |
| Communities | ✅ Working |
| Leads Board | ✅ Working |
| Achievements | ✅ Working |
| Global Search | ✅ Working |
| Premium | ❌ Stub only |
