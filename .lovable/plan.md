

## Fix all 404 routes in Soloboard

Currently only `/` works. Every sidebar link (`/new`, `/following`, `/communities`, `/bookmarks`, `/achievements`, `/profile`, `/settings`) hits the 404 page, and the "New Post" button has no destination. I'll add real pages for each route, all wrapped in the existing `AppLayout` so the sidebar/header stay consistent.

### Pages to create

| Route | Page | Content |
|---|---|---|
| `/new` | `NewFeed.tsx` | Same feed as Index, sorted by `timeAgo` (newest first), tab pre-selected to "New" |
| `/following` | `Following.tsx` | Feed filtered to a mock "following" subset, with empty-state CTA if the user follows no one |
| `/communities` | `Communities.tsx` | Grid of community cards (Design, Dev, Writing, Marketing, Video, Consulting) with member counts and "Join" buttons |
| `/bookmarks` | `Bookmarks.tsx` | List of saved posts (reuses `PostCard`) with empty state |
| `/achievements` | `Achievements.tsx` | Grid of badge cards (First Post, 100 Reputation, Helper, Veteran, etc.) — locked vs unlocked styling |
| `/profile` | `Profile.tsx` | Header with avatar, username, bio, skills, reputation, follower count; tabs for Posts / Comments / Achievements |
| `/settings` | `Settings.tsx` | Sectioned form: Account, Profile, Notifications, Availability status toggle |
| `/submit` | `CreatePost.tsx` | Title input, body textarea, post type selector (discussion/question/resource), tag picker (max 3) |
| `/post/:id` | `PostDetail.tsx` | Full post + threaded comments (mock, 3 levels deep) with vote controls |

All pages use mock data only — no backend wiring yet.

### Routing & navigation updates

- **`src/App.tsx`** — register all 9 new routes above the catch-all.
- **`src/components/AppSidebar.tsx`** — wrap the "New Post" button in a `NavLink to="/submit"` so it navigates.
- **`src/pages/Index.tsx`** — make `PostCard` titles link to `/post/:id` (small change in `PostCard.tsx`).

### Shared building blocks

- A small `PageHeader` component (title + optional subtitle) reused by Communities, Bookmarks, Achievements, Profile, Settings, CreatePost so every page has a consistent heading.
- An `EmptyState` component (icon + message + optional CTA) for Following and Bookmarks.

### Out of scope (future work)

- Real auth, database, and Supabase wiring (Foundation phase).
- Functional post submission, real voting persistence, real comments.
- Per-community sub-feeds and moderator tools.

After implementation every sidebar link, the New Post button, and clicking a post will land on a real page instead of the 404 screen.

