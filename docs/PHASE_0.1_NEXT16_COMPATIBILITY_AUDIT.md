# Borynx — Phase 0.1: Next.js 16 Compatibility Audit

Date: 2026-11-12
Branch: `arena/430a7e79-freelancer-s-hub` (from `migration/nextjs-app-router` @ `a6692b8`)
Target line: **Next.js 16 Active LTS**, latest patched stable = **`next@16.4.6`** (`next@latest`, no canary/RC).

---

## 1. Current state (baseline, measured before any change)

| Item | Baseline value | Verified by |
| --- | --- | --- |
| Next.js | `14.2.23` (flagged insecure by npm, CVE notice 2025-12-11) | `npm install` warning |
| React / React DOM | `18.3.1` / `18.3.1` | `package.json` |
| `@types/react` / `@types/react-dom` | `18.3.23` / `18.3.7` | `package.json` |
| TypeScript | `5.8.3` | `package.json` |
| Node | `v22.22.3` (Next 16 needs ≥ 20.9.0) ✅ | `node -v` |
| Bundler | Vite 5.4 (`dev`, `build`) + Next 14 webpack (`dev:next`, `build:next`) | `package.json` |
| Router | `react-router-dom@6.30.1` (Vite) aliased to `src/lib/navigation.tsx` (Next webpack alias) | `next.config.mjs` |
| Tests | Vitest 3.2.4 + jsdom 20 + RTL 16.0.0 → **44 tests / 9 files green** | `npx vitest run` |
| `tsc --noEmit` | **2 pre-existing errors** (see §7) | `npx tsc --noEmit` |
| ESLint | 9.32 flat config → **9 errors / 6 warnings, all pre-existing** | `npx eslint .` |
| `next build` (14.2.23) | ✅ 7 routes, 8 page entries | `npm run build:next` |
| Lockfiles | `package-lock.json` **inconsistent** (`@swc/helpers` mismatch → `npm ci` fails) + stale `bun.lock`/`bun.lockb` | `npm ci` |

### Files inspected

1. `package.json`, `package-lock.json` (lockfile v3, 755 packages).
2. `next.config.mjs` — `reactStrictMode`, `transpilePackages: ["lucide-react"]`, `typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`, `images.remotePatterns`, **`webpack()` resolve.alias for `react-router-dom`**.
3. `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`.
4. `tailwind.config.ts`, `postcss.config.js`, `src/index.css` (HSL design tokens).
5. App Router: `src/app/layout.tsx` + 8 page files (`/`, `/l`, `/login`, `/signup`, `/p/[id]`, `/b/[slug]`, `/b/[slug]/p/[id]`, `/f/[handle]`). All pages are `"use client"` + `dynamic(..., { ssr: false })` wrappers — **no `params`/`searchParams`/`cookies()`/`headers()` access anywhere**.
6. `src/lib/navigation.tsx` — React Router compatibility adapter (`Link`, `NavLink`, `useNavigate`, `useLocation`, `useParams`, `useSearchParams`, `Navigate`, router stubs for tests).
7. `src/lib/supabase.ts` — env resolution that reads both `VITE_*` and `NEXT_PUBLIC_*`, demo-mode mock client (`src/lib/mockSupabase.ts`), placeholder fallback.
8. `src/components/providers.tsx` — TanStack Query, `next-themes`, `AuthProvider`, Radix TooltipProvider, Radix Toaster + Sonner.
9. TipTap 3.22.5 (18 packages), Framer Motion 12.38.0, TanStack Query 5.83.0, 27 `@radix-ui/*` packages, `shadcn/ui` copies in `src/components/ui/*`.
10. `vitest.config.ts`, `src/test/setup.ts`, 9 test files.
11. `vite.config.ts` (port 8080, `allowedHosts: [".e2b.app"]`, manualChunks, `dedupe`).

---

## 2. Next.js 14 → 16 breaking changes that apply (or don't)

Source: official `version-16` upgrade guide.

| Change | Applies to Borynx? | Action |
| --- | --- | --- |
| Node ≥ 20.9, TS ≥ 5.1 | Requirements already met (Node 22.22, TS 5.8) | none |
| **Turbopack is the default bundler**; a `webpack()` config makes `next build` fail | **YES** — `next.config.mjs` has a `webpack()` alias | Explicitly pass `--turbopack`, and mirror the alias via `turbopack.resolveAlias`; keep `webpack()` so `--webpack` remains a rollback path |
| `next lint` removed, `eslint` config key removed | **YES** — `eslint.ignoreDuringBuilds` present | Remove the key; lint via `eslint .` (already the `lint` script). Next 16 no longer lints during build, so ESLint must be run separately |
| Async request APIs (`params`, `searchParams`, `cookies`, `headers`) | **NO** — no page/layout reads them | none |
| Async `params` for `opengraph-image`/`icon`/`sitemap`, parallel-route `default.js` | **NO** — none exist | none |
| `middleware` → `proxy` | **NO** — no middleware | none |
| `next/image` defaults (`qualities` → `[75]`, `minimumCacheTTL` 4 h, `imageSizes` drops 16, local IP block, 3 redirects) | **NO** — `next/image` is not imported anywhere; only `images.remotePatterns` is configured | keep `remotePatterns`, no behaviour change |
| `revalidateTag`/`cacheLife`/`cacheTag` signature changes | **NO** — no `next/cache` usage | none |
| `experimental.viewTransition`, `appNewScrollHandler`, `dynamicIO`, `useCache`, PPR flags removed | **NO** — not configured | none |
| `serverRuntimeConfig`/`publicRuntimeConfig` removed | **NO** | none |
| `scroll-behavior` no longer overridden | **NO** — `scroll-behavior` is not set in CSS | none |
| Runtime React 19.2.x for App Router | **YES** — app React must move to 19.x | §3 |
| React Compiler / Cache Components new flags | Not enabled on purpose | none |

---

## 3. React 18.3.1 → React 19 audit (dependency-by-dependency)

`npm view <pkg> peerDependencies` was checked for every direct dependency. Only packages whose peer range **excludes** `^19.0.0` force an upgrade.

### Must upgrade (peer range excludes React 19)

| Package | Current | Peer of current | Target | Why that target |
| --- | --- | --- | --- | --- |
| `react`, `react-dom` | 18.3.1 | — | `19.2.9` | The React version the Next 16 App Router is documented against (React 19.2). Newest 19.2 patch |
| `@types/react` | 18.3.23 | — | `19.2.18` | Must match React 19.2 |
| `@types/react-dom` | 18.3.7 | — | `19.2.7` | Must match React 19.2 |
| `next-themes` | 0.3.0 | `^16.8 \|\| ^17 \|\| ^18` | `^0.4.6` | First line that declares `^19`. API unchanged (`ThemeProvider`, `useTheme`) |
| `vaul` | 0.9.9 | `^16.8 \|\| ^17 \|\| ^18` | `^1.1.2` | Peer includes `^19.0.0`; `Drawer.Root/Portal/Overlay/Trigger/Close/Title/Description` and `shouldScaleBackground` kept |
| `react-day-picker` | 8.10.1 | `^16.8 \|\| ^17 \|\| ^18` | `^9.14.0` | v9 peers `react >= 16.8`. v9 is a classNames/`components` API change → `ui/calendar.tsx` migrated in §4 (component is **unused** by any view, but must keep compiling) |
| `@testing-library/react` | 16.0.0 | `^18.0.0` only | `^16.3.3` | 16.1+ declares `^18 \|\| ^19`; `render`/`screen`/`fireEvent`/`waitFor` API identical |
| `lucide-react` | 0.462.0 | `... \|\| ^19.0.0-rc` (no stable `^19`) | `^0.475.0` | First release whose peer range includes `^19.0.0`. 83 icon import sites unchanged; icon names used are stable across 0.462 → 0.475 |

### Retained (already React 19 compatible, verified peers)

`@tanstack/react-query@5.83` (`^18 \|\| ^19`), `framer-motion@12.38` (`^18 \|\| ^19`), `@tiptap/*@3.22.5` (`^17 \|\| ^18 \|\| ^19`), all 27 `@radix-ui/*` (`… \|\| ^19.0.0-rc`), `sonner@1.7.4` (`^18 \|\| ^19`), `embla-carousel-react@8.6`, `cmdk@1.1.1`, `input-otp@1.4.2`, `react-hook-form@7.61` + `@hookform/resolvers@3.10`, `recharts@2.15.4` (`^18 \|\| ^19`), `react-resizable-panels@2.1.9`, `react-markdown@10.1`, `react-router-dom@6.30.1` (`>=16.8`), `date-fns@3.6`, `@supabase/supabase-js@2.110`, `@supabase/ssr@0.5`, `dompurify`, `marked`, `turndown`, `zod`, `class-variance-authority`, `tailwind-merge`, `clsx`, `lucide` peers of shadcn stack, `vitest@3.2`, `jsdom@20`, `typescript@5.8`, `vite@5.4`, `@vitejs/plugin-react-swc@3.11`.

Nothing is bumped "because it is newer": TipTap, Radix, Query, Framer, Vite, Vitest, Tailwind, TypeScript, ESLint all stay on their Phase 0 versions.

### Deferred / future attention (not blocking)

* `recharts@2.15.4` — npm-deprecated branch ("bump to v3"), peer still allows `^19`; `ui/chart.tsx` is unused today. Recharts v3 is a breaking API change → defer to its own phase.
* `react-day-picker@9` pulls `date-fns@^4` nested; the app keeps `date-fns@3` (its two call sites use `format` / `formatDistanceToNowStrict`, unchanged in v4). Deduplicate in a later phase.
* `lucide-react` 0.x — every minor can rename an icon; stay pinned until a deliberate icon pass.
* `@types/dompurify@3` is a deprecated stub (dompurify ships its own types) — removal is cosmetic.
* `vaul@1` adds a direct `@radix-ui/react-dialog` dependency (already present).
* `vitest@3` + `jsdom@20` are older than the newest majors; they work, and upgrading them is unrelated to React/Next.
* `bun.lock` / `bun.lockb` are stale (Phase 0 was installed with npm) — left untouched, npm is the source of truth.

---

## 4. Application-level React 19 risks (checked, no rewrite needed)

| Risk | Result |
| --- | --- |
| `React.ElementRef` (104 uses in `ui/*`) | Still exported in `@types/react@19` (alias of `ComponentRef`) → compiles |
| `React.FC` | 1 use (`CreateSpacePostModal`); `@types/react` has not had implicit `children` since 18 → unchanged |
| `propTypes`, `defaultProps`, `findDOMNode`, `ReactDOM.render`, string refs | **none present** |
| `forwardRef` | still supported (soft-deprecated in 19.1) → unchanged |
| Implicit `children` in props | none |
| Client-only browser APIs during SSR | pages use `dynamic(..., { ssr: false })`, and `localStorage` / `matchMedia` are only touched in effects or event handlers |
| `next/link` `legacyBehavior` | not used |
| `@types/react` 19 stricter `ReactNode` | no `{}`-typed ReactNode props found |
| ESLint `.next/types` generated files being linted | `eslint.config.js` only ignores `dist` → add `.next`, `dist`, coverage to `ignores` |

## 5. Upgrade plan (executed)

1. `package.json`: `next@16.4.6`, `react/react-dom@19.2.9`, `@types/react@19.2.18`, `@types/react-dom@19.2.7`, `next-themes@^0.4.6`, `vaul@^1.1.2`, `react-day-picker@^9.14.0`, `@testing-library/react@^16.3.3`, `lucide-react@^0.475.0`.
2. `next.config.mjs`: drop the removed `eslint` key, add `turbopack.resolveAlias` mirroring the `react-router-dom` webpack alias, add `allowedDevOrigins` for preview hosts, keep `images`, `transpilePackages`, both bundler aliases. `typescript.ignoreBuildErrors` is dropped so `next build` type-checks (`npm run typecheck` is clean, see §7).
3. Scripts: `dev:next` = `next dev --turbopack -H 0.0.0.0 -p 3000`; `build:next` = `next build --turbopack`; add `build:next:webpack` rollback + `typecheck`.
4. `ui/calendar.tsx`: migrate to react-day-picker v9 API (`components.Chevron`, v9 class keys), keeping the same Tailwind classes/tokens.
5. `tsconfig.json`: keep as is (TS 5.8 ≥ 5.1); `next build` regenerates `next-env.d.ts`.
6. `eslint.config.js`: ignore `.next`, `dist`, `coverage`.
7. Regenerate `package-lock.json` with npm (also repairs the broken `npm ci`).
8. Keep Vite app, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `index.html` untouched → full rollback = `npm run dev` / `npm run build`.

## 6. Preservation guarantees

No page/route/component design changes. No token, colour, asset, Supabase, mock-DB, or test changes. No auth, no Neon/Drizzle.

## 7. Pre-existing defects found in the audit (fixed — all were real bugs, not upgrade fallout)

1. `src/views/CreatePost.tsx:450` — `toast` is imported from `@/hooks/use-toast` (a callable that has no `.error`), yet the code calls `toast.error(...)`. Same class of call elsewhere uses `sonner`. Fix: use the existing `toast({ variant: "destructive" })` shape from the same module.
2. `src/test/CreatePost.test.tsx:70` — `mockResolvedValue([])` where `DocumentUploadResult` is expected. Fix: `{ uploaded: [], failed: [] }`.
3. `package-lock.json` out of sync with `package.json` (`npm ci` fails).
4. `src/lib/navigation.tsx` `NavLink` built its `class` by string-interpolating a
   `className` **render prop**: every active sidebar link rendered
   `class="... ({ isActive }) => cn(...)"` into the DOM, so `data-active` styling
   never applied. Fixed while keeping the same API (`className` may be a string or
   a function, plus `activeClassName` / `pendingClassName`).
5. `src/lib/navigation.tsx` `useParams` used `require("next/navigation")` inside a
   component (ESLint error, and `require` is not available in ESM/Turbopack
   client code). Replaced with a static import.
6. `src/views/CreatePost.tsx` navigated away from the "your post is live" screen
   even when document uploads had failed, discarding the retry affordance the UI
   promised. It now stays on that screen while failed documents remain.

## 8. Route coverage under Next.js 16

Phase 0 shipped 8 App Router pages (`/`, `/l`, `/login`, `/signup`, `/p/[id]`,
`/b/[slug]`, `/b/[slug]/p/[id]`, `/f/[handle]`). Because the sidebar uses the
compatibility `Link` (`next/link`), every other destination was a hard reload /
404 under `next dev`. 23 client-only shells were added so the Next build matches
the React Router table in `src/App.tsx`: `/communities`, `/new`, `/popular`,
`/leaderboard`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`,
`/submit`, `/onboarding`, `/settings`, `/pipeline`, `/applications`,
`/notifications`, `/bookmarks`, `/achievements`, `/my-reports`, `/drafts`,
`/admin`, `/tag/[tagName]`, `/l/post`, `/l/[leadId]`, `/f/me`. All 31 routes
return 200 on both `next dev` and `next start`; an unknown path returns 404.
They are shells only — no page design changed.
