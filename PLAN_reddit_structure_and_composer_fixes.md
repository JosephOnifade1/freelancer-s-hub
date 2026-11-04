# Plan: Reddit-Like Structure + Floating Button Removal + Composer Fixes

## What I understand you want

### 1. Remove Duplicate Floating Action Buttons (FABs)
**Current state:**
- Feed page: floating pencil button (bottom-right) opens `/submit` page
- Communities page: floating "+" button opens `CreateCommunityModal`
- CommunityDetail page: floating pencil button (bottom-right) opens `/submit` page

**Problem:** Multiple buttons do the same job on the same page. Redundant UI clutter.

**Fix:** Delete all floating action buttons entirely. Users already have:
- `+ Create` navbar button at top for posts
- `+ NEW_SPACE` sidebar link for creating communities

No FABs needed. Clean.

---

### 2. Reddit-Like URL Structure
**Current state:**
- Communities: `/b/{slug}` (this is correct — keeping it)
- User profiles: `/u/{username}` or `/f/{uid}` (inconsistent)

**Change to:**
- User profiles: `f/{username}` consistently (matching Reddit's `r/` pattern as `b/` + `f/` for "freelancer")
- Update all links, routes, breadcrumbs, sidebar nav to use `f/username`

**Routing changes needed:**
- App.tsx: Update route from `/u/:username` to `/f/:username`
- Update breadcrumb labels
- Update any profile link generation across the codebase

---

### 3. Post Appearance Issue — Posts Not Showing in Selected Community
**Current problem:** User posts to "Freelance Dev" community, post doesn't appear on `/b/dev` (the community page).

**Root cause likely:** When a post is created, it's inserted with `communitySlug: selectedSpace.slug`, but the community detail page's query `fetchPostsByCommunity(slug)` might not be re-fetching after the post is created, OR the post's `communitySlug` value isn't being set correctly in the createPost payload.

**Fix needed:**
- Verify `createPost()` in posts.ts actually saves `communitySlug` to the database (trace through the payload)
- Verify CommunityDetail.tsx invalidates its `["communityPosts", slug]` query after a new post is created
- Test the full flow: create post → select "Freelance Dev" → navigate to `/b/dev` → see the new post there

---

### 4. Composer: Add "Your Profile" as a Posting Target (Like Reddit's r/username)
**Reddit pattern:**
- When posting, you can target:
  - A subreddit: `r/python`, `r/funny`, etc.
  - Your own profile feed: `r/username`
- They appear together in the dropdown

**Current Borynx state:**
- Composer only shows communities (`fetchAllCommunities`)
- No option to post to your own profile

**Change to:**
- In `CreatePost.tsx`, the space/community picker should show:
  1. **Your Profile** (posts to `f/{currentUser.username}`, no `communitySlug` in DB — null or empty)
  2. **All Communities** (posts to `b/{space.slug}`, with `communitySlug` set)
- When "Your Profile" is selected, the post goes to the user's profile page instead of a community
- Update the selector UI to look like the Reddit screenshot you shared (profile at top, then communities below)

**Implementation:**
- Modify the `B_SPACES` / community picker in CreatePost.tsx to include a "Your Profile" option at the top
- Pass a flag through createPost to indicate if it's a profile post vs community post
- Update post fetching: Profile.tsx uses `fetchPostsByAuthor()` (already exists), communities use `fetchPostsByCommunity()`
- Navbar button text should change: when "Your Profile" selected → "Post to Profile" instead of "Post to Space"

---

## What stays the same

- Post card design (already unified)
- Sidebar widgets (already real data)
- Feed/Following/Popular tabs
- Like/bookmark/comment functionality
- All other composer features (type toggle, rich editor, tags, polls, etc.)

---

## Order of implementation

1. **Fix composer targeting** — add "Your Profile" option to the space picker, wire it through to database
2. **Verify post appearance** — trace createPost payload and invalidation, test community posts appear
3. **Remove FABs** — delete floating buttons from Index, Communities, CommunityDetail
4. **URL structure** — update routes and all references from `/u/` to `/f/`

---

## Database/Query changes needed

**In createPost():** Already passes `communitySlug`, just need to verify it's in the payload and saved.

**New logic in createPost():** If `communitySlug` is null/undefined (profile post), insert with `communitySlug: null`.

**Profile.tsx `fetchPostsByAuthor`:** Already exists, filters `authorUid` — this is the real data source for profile posts.

**CommunityDetail.tsx invalidation:** After create post modal closes, must call `queryClient.invalidateQueries({ queryKey: ["communityPosts", slug] })` so the community feed refetches.

---

## Routes that need updating

- `/u/:username` → `/f/:username` (App.tsx, all NavLinks, breadcrumbs)
- All profile link generation: `.to(`/f/${username}`)` instead of `/u/`
- Sidebar "Profile" button if it exists

---

## Files to modify

1. **CreatePost.tsx** — Add "Your Profile" option to space picker, handle null communitySlug
2. **App.tsx** — Update route path from `/u/:username` to `/f/:username`
3. **Index.tsx, CommunityDetail.tsx** — Remove floating action buttons
4. **Communities.tsx** — Remove floating action button
5. **posts.ts** — Verify createPost saves communitySlug (should already be there)
6. **Any file with profile links** — Update `/u/` to `/f/`
7. **CommunityDetail.tsx** — Add query invalidation after post creation

---

## Do you agree with this plan?

Before I start, confirm:
1. ✓ Remove all floating buttons (pencil on Feed, "+" on Communities, pencil on CommunityDetail)?
2. ✓ Add "Your Profile" as a posting target alongside communities in the composer?
3. ✓ Change all user profile URLs from `/u/username` to `/f/username`?
4. ✓ Fix posts not appearing in communities (trace/fix invalidation and payload)?

Anything I misunderstood or would like changed before I proceed?
