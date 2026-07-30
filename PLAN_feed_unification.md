# Plan: Unify Post Card + Kill Remaining Fake Sidebar Data

## What I found

Your home Feed page (`Index.tsx`) never got switched over to the real shared
components. It has its own hand-built, older post card design, and its own
sidebar — both separate from the real ones I built into `Popular.tsx`. That's
exactly why the two pages look and behave differently in your screenshots.

### 1. Two different post card designs

- **Feed page**: a bespoke card I did not write to use the shared component —
  square avatar, single vote pill, no Share/Save/"..." menu, and — this is
  the important part — it does **not** render the real `PollWidget` I built
  last round. That's why your poll post shows raw text ("new poll option for
  testing") instead of actual clickable poll options with vote bars.
- **Popular page**: uses the real, shared `PostCard` component — round
  avatar, full action row (vote / comment / share / save / more), and it
  *does* render real polls correctly.

**Fix:** rip out Feed's bespoke card markup, render posts through the same
`PostCard` component Popular already uses. One card design, everywhere,
automatically inherits every fix I've made to `PostCard` (and every future
one).

### 2. Feed sidebar is three separate fake widgets

None of these hit the database — all hardcoded arrays sitting directly in
`Index.tsx`:

- **"Trending Tags"** — 8 hardcoded tags (`#pricing`, `#growth`, `#clients`...)
  that have nothing to do with what's actually been posted.
- **"Top Contributors"** — 5 fake people (`MarceloDev`, `SarahWrites`...)
  with fake XP numbers and fake stock-photo avatars. Every single one shows
  a green "verified" checkmark regardless of anything real.
- **"Active B-Spaces"** — the *exact* fake community list (`frontend-hub`,
  `indie-builders`, `growth-operators`...) I already removed from
  `Communities.tsx` and `CreatePost.tsx` two sessions ago. This is a leftover
  fourth copy of the same dead data I missed because I was scoped to other
  files at the time.

The good news: **a real version of the first two already exists and is
already working correctly** — it's the `FeedSidebar` component, already used
on the Popular page. It pulls real trending tags (computed from actual post
data), real top contributors (real DB query, real reputation, real verified
badges), and adds a real "Community Live Stats" block (active members, total
posts) that Feed doesn't even have yet.

**Fix:** swap Feed's fake sidebar for the same real `FeedSidebar` component.

**One gap:** `FeedSidebar` doesn't have an "Active Spaces" equivalent — I'd
add a new real one (top communities by member count, using the same
`fetchAllCommunities()` you already have) so you don't lose that entirely.

**One thing I noticed while re-checking `FeedSidebar` itself:** it's mostly
real, but "98% Helpful rate" and "< 1h Avg Response" in its Community Live
Stats block are still hardcoded. Small, but since this component is about to
appear on Feed too, I'd fix it in the same pass — either compute something
real (e.g. % of posts with a reply, median time-to-first-comment) or remove
those two stats if the real numbers aren't meaningful yet with your current
post volume.

## What I'll actually do, in order

1. Replace Feed's bespoke post card JSX with the shared `PostCard` component
   (same as Popular already does).
2. Replace Feed's 3 fake sidebar widgets with the real `FeedSidebar`
   component.
3. Add a real "Active Spaces" widget to `FeedSidebar` (top communities by
   member count) so Feed doesn't lose that section.
4. Fix or remove the two remaining hardcoded stats inside `FeedSidebar`
   ("Helpful rate", "Avg Response").
5. Rebuild, typecheck, confirm no regressions in the like/bookmark/composer
   logic that already works on Feed.

## What does NOT change

- The "For You" / "Following" tabs and their filtering logic (already fixed,
  already real).
- The composer bar, quick-action buttons, floating pencil (already unified
  to `/submit`).
- Anything on Popular, Communities, or other pages.

## Question before I start

For the "Helpful rate" / "Avg Response" stats — compute something real, or
just remove them for now until you have enough data for them to mean
anything? My take: remove for now, add back once real numbers would
actually be interesting. But it's your call.
