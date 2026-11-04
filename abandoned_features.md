# 🔍 Abandoned / Incomplete Features in Borynx

> Last updated: 2026-11-05 — reflects full audit + fixes applied in this session.

---

## 1. `/following` Feed — ✅ FIXED

**File**: `src/pages/Following.tsx`

Previously built but never registered as a route and not listed in the sidebar.

**Fix applied**:
- Route `/following` added to `App.tsx`
- "Following" link (with `Users` icon) added to `AppSidebar.tsx` mainNav

---

## 2. Global Search — ⚠️ Works with edge cases

**File**: `src/lib/search.ts` + `src/components/AppLayout.tsx`

Fully functional for text search across posts and users. Known edge cases:
- Posts without a `communitySlug` fall back to `/p/:id` which is correct.
- Username vs UID routing resolves correctly via `/f/:handle`.

**Status**: Functionally sound. No change needed.

---

## 3. `VeteranCelebration` — ✅ FIXED (reactive)

**File**: `src/components/VeteranCelebration.tsx`

Previously only triggered on hard reload because reputation updates didn't invalidate the profile query.

**Fix applied**:
- `VoteControls.tsx` now calls `queryClient.invalidateQueries({ queryKey: ['profile', authorUid] })` after every vote — this causes `VeteranCelebration` to re-check mid-session whenever reputation crosses 1000.

---

## 4. Drafts — ✅ FIXED

**Files**: `src/pages/Drafts.tsx` (new), `src/App.tsx`

Previously `/drafts` rendered a ComingSoonPage. `CreatePost.tsx` already had `handleSaveDraft()` writing to `localStorage` but there was no page to view or resume drafts.

**Fix applied**:
- Created `src/pages/Drafts.tsx` — reads from `localStorage` key `borynx_post_draft`, displays title preview, body preview, tags, and type. "Continue editing" navigates back to `/submit` where `CreatePost` auto-loads the draft. Delete button clears localStorage.
- `App.tsx` `/drafts` route now renders `<Drafts />` instead of ComingSoonPage.

---

## 5. Premium — ❌ Still a stub

**File**: `App.tsx`

`/premium` renders a `ComingSoonPage`. No subscription system, no Stripe integration.

**Status**: Route placeholder only. Not in scope without payment infrastructure.

---

## 6. Online Status Toggle — ✅ FIXED

**File**: `src/components/AppLayout.tsx`

Logic (`toggleOnlineStatus`) existed but had no UI trigger.

**Fix applied**:
- Avatar dropdown menu now contains an "Available / Appear Offline" toggle button with `Wifi`/`WifiOff` icons and a live status dot.

---

## 7. `NewFeed` — ✅ FIXED

**File**: `src/pages/NewFeed.tsx`

Previously built and routed at `/new` but hidden from the sidebar navigation.

**Fix applied**:
- "New" link (with `Zap` icon) added to `AppSidebar.tsx` mainNav.

---

## 8. `PostIdentity` Lib — ⚠️ Exists, low priority

**File**: `src/lib/postIdentity.ts`

Logic partially inlined in `PostCard.tsx`. Not blocking anything.

**Status**: No action taken. Low priority refactor.

---

## 9. Bookmarks — ✅ FIXED

**Files**: `src/lib/users.ts`, `src/pages/Bookmarks.tsx`, `src/components/PostCard.tsx`, `src/pages/PostDetail.tsx`

**Fixes applied**:
- `toggleBookmark()` changed from `.single()` to `.maybeSingle()` — was throwing PGRST116 on first toggle.
- `getSavedPostIds()` function added to `users.ts` — directly queries `saved_posts` table.
- `Bookmarks.tsx` rewrote to use `getSavedPostIds` via its own React Query rather than relying on profile's `savedPosts` field.
- `PostCard.tsx` and `PostDetail.tsx` now invalidate `['savedPosts', uid]` on bookmark toggle.

---

## 10. Leads Board Unification — ✅ FIXED

**Files**: `src/lib/leads.ts`, `src/pages/LeadsBoard.tsx`, `src/pages/LeadDetail.tsx`

**Fixes applied**:
- `createLead()` now mirrors new leads into `saveBoardLead()` so the Kanban board reflects them immediately.
- `LeadsBoard.tsx` syncs remote Supabase leads into local board on mount via `syncSupabaseLeadsToBoard()`.
- Board card dropdowns have "View Details" link; list view title cells are clickable `<Link>` components.
- `LeadDetail.tsx` "Apply Now" opens a Dialog with proposal textarea; "Share" copies URL; "Report" shows toast.

---

## 11. Auth Error Messages — ✅ FIXED

**Files**: `src/pages/Login.tsx`, `src/pages/Signup.tsx`

Added specific "Failed to fetch" catch to show a friendly offline/connectivity message instead of a raw error.

---

## Summary Table

| Feature | Status |
|---|---|
| `/following` Feed | ✅ Fixed — routed + in sidebar |
| Global Search | ⚠️ Works — minor edge cases remain |
| Veteran Celebration | ✅ Fixed — now reactive on vote |
| Drafts | ✅ Fixed — real page, localStorage-backed |
| Premium | ❌ Stub only — needs payment infra |
| Online Status Toggle | ✅ Fixed — UI button in avatar menu |
| `/new` New Feed | ✅ Fixed — added to sidebar nav |
| Bookmarks | ✅ Fixed — toggle + page both work |
| Leads Board Sync | ✅ Fixed — board + detail fully wired |
| Auth Error Messages | ✅ Fixed — friendly "Failed to fetch" message |
| PostIdentity Helper | ⚠️ Exists — low priority refactor |
