# 🔍 Abandoned / Incomplete Features in Borynx

## 1. `/following` Feed — Built but Never Routed

**File**: `src/pages/Following.tsx`

`Following.tsx` is a fully implemented page — it fetches followed user IDs, filters posts, renders them with the full `PostCard` + `FeedSidebar` layout, and shows a proper empty state.

**Problem**: It is **never registered as a route** in `App.tsx` and there is no navigation link to it anywhere in the sidebar or nav. The page is completely unreachable from the UI.

**Fix**: Add route `/following` in `App.tsx` and add it to the sidebar navigation.

---

## 2. Global Search — Built but Only Half-Wired

**File**: `src/lib/search.ts` + `src/components/AppLayout.tsx`

`search.ts` exports a full `globalSearch()` function that queries both posts and users from Supabase using `ilike` filtering. `AppLayout.tsx` debounces queries and renders a dropdown with results. Keyboard navigation (arrow keys, Enter) is implemented.

**Problem**: The search navigates users to `/u/:username` paths, but the actual user profile route in `App.tsx` uses **both `/u/:uid` and `/u/:username`** — however the routes are defined twice for the same component and there's no guaranteed disambiguation. Also: search results for community posts link to `/b/${category}/p/${id}` but if the post has no `category`, it falls back to `/p/${id}` — which might be correct, but `communitySlug` vs `category` appears inconsistently used.

**Status**: Functionally works but has routing edge cases that could produce broken links.

---

## 3. `VeteranCelebration` — Built but Never Triggered Properly

**File**: `src/components/VeteranCelebration.tsx`

The component checks if a user has `reputation >= 1000` (veteran threshold) AND `hasSeenVeteranCelebration === false`, then shows an animation and marks it as seen. It's mounted in `AppLayout` which is correct.

**Problem**: In `src/lib/users.ts`, the `createUserProfile` function initialises `hasSeenVeteranCelebration: false` correctly. BUT — the function that updates reputation does not re-check or re-query the profile, meaning the celebration is only triggered if the user happens to reload the page at the exact right time. There's no reactive check when reputation crosses 1000 mid-session.

**Status**: Works on hard reload, silent during live session reputation updates.

---

## 4. Drafts — Route Exists, Feature Doesn't

**File**: `App.tsx` line 145

The `/drafts` route renders a `ComingSoonPage`. No draft data model, no `saveDraft()` function in `lib/posts.ts`, no UI element in `CreatePost.tsx` to save a draft.

**Status**: Completely stubbed — route only. The "Save Draft" button never existed.

---

## 5. Premium — Route Exists, Feature Doesn't

**File**: `App.tsx` line 146

`/premium` renders a `ComingSoonPage`. No subscription system, no feature gating anywhere, no Stripe integration or similar.

**Status**: Route placeholder only.

---

## 6. Online Status Toggle — Built but Not Visible Anywhere

**File**: `src/components/AppLayout.tsx` lines 57–65

`toggleOnlineStatus()` is implemented — it writes `status: "Available" | "offline"` to the `profiles` table. The `isOnline` state is set from `profile.status`.

**Problem**: The toggle function exists and works, but there is **no UI button** that calls `toggleOnlineStatus()`. It was presumably going to be in the avatar dropdown menu, but it's missing. The status dot shown in some places in the UI is therefore always based on whatever is in the DB with no way to change it from the app.

**Status**: Logic complete, UI trigger missing.

---

## 7. `NewFeed` — Missing from Navigation Sidebar

**File**: `src/pages/NewFeed.tsx` + `App.tsx` line 110

`NewFeed.tsx` is a full page (sorted by `createdAt` descending) and is properly routed at `/new`.

**Problem**: It is **not listed in `AppSidebar.tsx`** `mainNav` or `discover` arrays. Users have no way to navigate to `/new` from the sidebar unless they type the URL manually. Only FEED and POPULAR are in the main nav.

**Status**: Built and routed, but hidden from navigation.

---

## 8. `PostIdentity` Lib — Built but Underused

**File**: `src/lib/postIdentity.ts`

This file provides logic for computing the display identity of a post (whether it was made by a profile or a community). It was likely built to centralise the `f/ vs b/` routing logic.

**Problem**: Looking at `PostCard.tsx`, the logic appears to be partially inlined rather than using this helper. It may be redundant or the migration to using it was abandoned halfway.

---

## Summary Table

| Feature | File(s) | Status |
|---|---|---|
| `/following` Feed | `Following.tsx` | ✅ Built — ❌ Never routed |
| Global Search | `search.ts` / `AppLayout.tsx` | ⚠️ Built — edge case bugs |
| Veteran Celebration | `VeteranCelebration.tsx` | ⚠️ Built — not reactive |
| Drafts | `App.tsx` | ❌ Route stub only |
| Premium | `App.tsx` | ❌ Route stub only |
| Online Status Toggle | `AppLayout.tsx` | ✅ Logic done — ❌ No UI button |
| `/new` New Feed | `NewFeed.tsx` | ✅ Built — ❌ Hidden from nav |
| PostIdentity Helper | `postIdentity.ts` | ⚠️ Exists — possibly unused |
