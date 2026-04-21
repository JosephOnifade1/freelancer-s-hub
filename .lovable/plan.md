

## Populate Profile page with real data + functional tabs

The Profile page already has a header with mock identity (marcelo_dev), reputation, follower count, and skills. The tabs render but Comments and Achievements show placeholder text. I'll keep the existing header (it already fits the spec) and focus on making the data centralized and the three tabs fully populated.

### 1. Create `src/data/mockProfile.ts`

A single source of truth for the current user so the same data can be reused on Profile, comments, and future pages.

```ts
mockProfile = {
  username: "marcelo_dev",
  initial: "M",
  bio: "Fintech dashboards & React specialist...",
  location: "Lisbon, Portugal",
  website: "marcelo.dev",
  joined: "2024",
  status: "Open to work",
  skills: ["React", "TypeScript", "UI Design", "Figma", "Copywriting"],
  reputation: 2340,
  followers: 847,
  following: 124,
  postsCount: 3,
  commentsCount: 18,
}
```

Plus a `mockUserComments` array (6–8 entries) with: id, postTitle, postId, body, score, timeAgo.

### 2. Move achievements list into shared data

Extract the `achievements` array from `Achievements.tsx` into `src/data/mockAchievements.ts` so both pages render the same badges. `Achievements.tsx` imports from there (no UI change).

### 3. Update `src/pages/Profile.tsx`

- Replace hardcoded values with imports from `mockProfile`.
- Add a `postsCount` / `commentsCount` count next to each tab label, e.g. `Posts (3)`, `Comments (18)`, `Achievements (3/8)`.
- **Posts tab**: filter `mockPosts` by `author.name === mockProfile.username` instead of `slice(0, 3)`.
- **Comments tab**: render a list of comment cards. Each card shows the parent post title (linked to `/post/:id`), the comment body, score with an upvote icon, and timeAgo. Empty state if list is empty.
- **Achievements tab**: render a compact 2/3-column grid using the shared achievements data and the same locked/unlocked styling as the Achievements page (smaller card, no animation delay). Footer link to `/achievements` for the full page.

### 4. Visual consistency

- Reuse existing tokens (`badge-resource` for status, `glow-primary` on avatar, `bg-card` borders).
- Comment cards use the same `rounded-xl border border-border bg-card` pattern as PostCard.
- Achievement grid in the tab: `grid-cols-2 sm:grid-cols-3` with `h-10 w-10` icon circles (smaller than the dedicated page).

### Out of scope

- Real auth / fetching the logged-in user from Supabase (Foundation phase).
- Editing profile inline (Settings page already covers this).
- Pagination on posts/comments lists.

After this, every Profile tab shows real, linked content sourced from one mock data file that can later be swapped for a Supabase query.

