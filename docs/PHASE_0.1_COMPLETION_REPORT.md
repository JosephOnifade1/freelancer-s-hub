# Borynx — Phase 0.1 Completion Report

**Next.js 14.2.23 → Next.js 16.4.6 (Active LTS) on React 19.2**

Date: 2026-11-12
Branch: `arena/430a7e79-freelancer-s-hub` (branched from `migration/nextjs-app-router` @ `a6692b8`)
Scope: foundation upgrade only — no auth, no Neon/Drizzle, no redesigns.

---

## 1. Framework versions

| | Before | After |
| --- | --- | --- |
| Next.js | `14.2.23` (npm flagged it insecure) | **`16.4.6`** — `next@latest`, the newest stable patch on the 16 line (no canary/RC/preview) |
| Bundler | webpack (Next 14 default) | **Turbopack** (Next 16 default), with a webpack escape hatch |
| React | `18.3.1` | **`19.3.1`** (`^19.2.9` declared; Next 16 App Router requires the React 19 line, and the installed React 19.2 types are satisfied by 19.3.x — no duplicate copies in the tree) |
| React DOM | `18.3.1` | **`19.3.1`** |
| `@types/react` | `18.3.23` | **`19.3.0`** (`^19.2.18`) |
| `@types/react-dom` | `18.3.7` | **`19.3.0`** (`^19.2.7`) |
| Node | 22.22.3 | 22.22.3 (Next 16 requires ≥ 20.9) ✅ |
| TypeScript | 5.8.3 | 5.8.3 declared, 5.9.3 resolved (Next 16 requires ≥ 5.1) ✅ |
| Vite app | Vite 5.4.21 | unchanged — still builds and still runs |

## 2. Dependencies updated (only where React 19 required it)

| Package | Before | After | Reason |
| --- | --- | --- | --- |
| `next` | 14.2.23 | 16.4.6 | target line |
| `react` / `react-dom` | 18.3.1 | 19.3.1 | Next 16 requirement |
| `@types/react` / `@types/react-dom` | 18.x | 19.3.0 | matching types |
| `next-themes` | 0.3.0 | 0.4.6 | 0.3 peers only `^18`; 0.4 adds `^19` — same API |
| `vaul` | 0.9.9 | 1.1.2 | 0.9 peers only `^18`; 1.x adds `^19` |
| `react-day-picker` | 8.10.1 | 9.14.0 | v8 peers only `^18`; v9 peers `>=16.8` (`ui/calendar.tsx` migrated to the v9 class/`Chevron` API; the component is unused by any view) |
| `lucide-react` | 0.462.0 | 0.475.0 | 0.462 declared only `^19.0.0-rc`; 0.475 declares `^19.0.0`. All 83 icon imports unchanged |
| `@testing-library/react` | 16.0.0 | 16.3.3 | 16.0 peers only `^18`; 16.1+ adds `^19` |

## 3. Dependencies deliberately retained

`@tanstack/react-query` 5.83, `framer-motion` 12.38, all 20 `@tiptap/*` 3.22.5 packages, all 27 `@radix-ui/*` packages, `sonner` 1.7.4, `recharts` 2.15.4, `react-resizable-panels` 2.1.9, `react-markdown` 10.1, `remark-gfm`/`rehype-*`, `react-router-dom` 6.30.1, `date-fns` 3.6, `@supabase/supabase-js` 2.110, `@supabase/ssr` 0.5, `react-hook-form` 7.61, `@hookform/resolvers` 3.10, `cmdk`, `embla-carousel-react`, `input-otp`, `tailwindcss` 3.4, `tailwindcss-animate`, `class-variance-authority`, `tailwind-merge`, `zod`, `dompurify`, `marked`, `turndown`, `vitest` 3.2, `jsdom` 20, `@vitejs/plugin-react-swc` 3.11, `lovable-tagger`, ESLint 9. Every one of these already accepts React 19 (peers verified individually).

## 4. Dependencies requiring future attention (not blocking)

* **`recharts` 2.15.4** — npm-deprecated branch; peer allows `^19`; `ui/chart.tsx` is currently unused. Recharts v3 is a breaking API change → its own phase.
* **`react-day-picker` 9** now nests `date-fns@4` while the app keeps `date-fns@3` (two call sites: `format`, `formatDistanceToNowStrict` — unchanged in v4). Deduplicate later.
* **`lucide-react` 0.x** — minor releases may rename icons; pinned until a deliberate icon pass.
* **`@types/dompurify` 3.0.5** — deprecated stub (dompurify ships types). Cosmetic removal later.
* **`vitest` 3 / `jsdom` 20** — older majors; unrelated to React/Next, working.
* **`bun.lock` / `bun.lockb`** — stale from before Phase 0; npm is the source of truth. Left untouched.

## 5. Files modified

Configuration
* `package.json` — versions + scripts (`dev:next` → `next dev --turbopack -H 0.0.0.0 -p 3000`; `build:next` → `next build --turbopack`; new `build:next:webpack`, `dev:next:webpack`, `typecheck`).
* `package-lock.json` — regenerated; `npm ci` now works (it failed before the upgrade).
* `next.config.mjs` — removed the Next-16-removed `eslint` key and `typescript.ignoreBuildErrors`; added `turbopack.resolveAlias` for `react-router-dom`, `allowedDevOrigins`; kept `images.remotePatterns`, `transpilePackages`, and the webpack alias as the rollback path.
* `tsconfig.json` — `jsx: "react-jsx"` and `.next/dev/types` include (Next 16 mandatory changes), formatting normalised.
* `eslint.config.js` — ignore `.next`, `dist`, `coverage`, `next-env.d.ts`.
* `.gitignore` — ignore `*.tsbuildinfo`.
* `README.md` — Next 16 scripts and env-var notes.

Application code
* `src/components/ui/calendar.tsx` — react-day-picker v9 API.
* `src/lib/navigation.tsx` — `NavLink` render-prop fix; `useParams` static import; `any` → precise types (ESLint).
* `src/lib/supabase.ts` — removed `@ts-ignore` (`import.meta.env` typed via `ImportMeta`); env behaviour unchanged (Vite + Next names both honoured).
* `src/views/CreatePost.tsx` — `toast.error` → supported toast API; stay on the retry screen while documents are outstanding.
* `src/test/CreatePost.test.tsx` — corrected `uploadPostDocuments` mock value.
* `src/app/layout.tsx` — `data-scroll-behavior="smooth"` (restores Next's pre-16 navigation scroll behaviour).
* `src/app/**/page.tsx` (8 existing) — identical client-only shells, tidied loader.
* `src/app/**` — 23 **new** client-only route shells (listed in the audit, §8).
* `src/test/next16-compat.test.tsx` — new: React 19 SSR smoke test for three views + adapter-surface and NavLink render-prop assertions.

Docs
* `docs/PHASE_0.1_NEXT16_COMPATIBILITY_AUDIT.md`, `docs/PHASE_0.1_COMPLETION_REPORT.md`.

**Not touched:** every `src/views/*` (except the CreatePost fix), every other component, `src/index.css`, `tailwind.config.ts` (tokens/colours), `public/`, Supabase schema/migrations, `src/lib/mockSupabase.ts`, all other tests, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `index.html`, `vitest.config.ts`.

## 6. Build results (actually executed)

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit -p tsconfig.json` | **PASS** (0 errors; 2 pre-existing errors fixed) |
| ESLint | `npx eslint .` | **PASS** — 0 errors, 6 warnings (all pre-existing fast-refresh warnings); was 9 errors before |
| Vitest | `npx vitest run` | **PASS — 10 files, 49/49 tests** (44 pre-existing + 5 new) |
| Next 16 production build | `npm run build:next` (Turbopack) | **PASS** — compiled in 9.2 s, TypeScript checked, 27/27 static pages, 31 routes emitted |
| Next 16 webpack build (escape hatch) | `npm run build:next:webpack` | **PASS** |
| Vite production build | `npm run build` | **PASS** (8.2 s) |
| Lockfile integrity | `npm ci` | **PASS** (previously failed with an `@swc/helpers` mismatch) |
| Peer dependency health | `npm ls --all` | 0 invalid peers; single `react`/`react-dom` copy (19.3.1) |
| `next start` route checks | 31 routes + 1 unknown | **31/31 → 200**, unknown path → 404 |
| `next dev` route checks | 6 routes incl. dynamic | all 200, no error overlay markers, no server-side exceptions in logs |
| Static asset / chunk checks | all `_next/static` refs per route | 0 missing files; every emitted chunk parses (`node --check`) |
| Design-token check | compiled CSS | `--brand`, `--background`, `--radius*`, `--shadow*`, theme safelist, Tailwind utilities all present; identical values to before |
| Adapter bundling | built client chunks | compatibility adapter present in 22 chunks; the real `react-router` context error string is absent |

## 7. Compatibility findings and resolutions

* **Turbopack vs. `webpack()` config** — Next 16 refuses to build with a webpack config under Turbopack. The React Router alias is now declared for both bundlers; Turbopack is the default, `--webpack` remains available.
* **`next lint` / `eslint` config key removed** — lint runs through `npm run lint` (ESLint CLI) in CI/validation; `next build` no longer lints (it does type-check).
* **Async request APIs / `middleware` → `proxy` / `next/image` defaults / cache APIs / removed experimental flags** — none apply: the app never reads `params`, `searchParams`, `cookies()` or `headers()`, has no middleware, no `next/image`, no `next/cache`, no PPR/cache flags.
* **React 19 code audit** — 104 `React.ElementRef` uses and 1 `React.FC` are still valid; no `propTypes`, `defaultProps`, `findDOMNode`, `ReactDOM.render`, string refs, or implicit `children`. `ui/calendar.tsx` was the only component using a library whose peer range excluded React 19 (and its v9 migration was required).
* **Hydration** — every route is a client-only shell (`ssr: false`), so the prerendered HTML is the spinner and the client markup matches it. `suppressHydrationWarning` on `<html>` covers `next-themes` class injection, exactly as before.
* **Browser APIs** — `localStorage`/`matchMedia`/`window` reads happen in effects or event handlers only; an SSR render test of the landing, leads-board and login views passes.
* **Bugs found and fixed while auditing** (all pre-existing, all would have failed validation): broken `npm ci`; `toast.error` called on a toast helper that has no `.error`; `NavLink` writing a render function into `class=""` (broke active-link styling); `require()` in `navigation.tsx`; profile posts with failed document uploads navigating away from the retry screen.

## 8. Remaining compatibility issues / known gaps

1. **No headless browser in this sandbox.** Chromium could not be installed (browser download blocked, `apt` needs root), so *visual* hydration/appearance was **not** verified in a real browser. Everything reachable without one was checked: SSR render of real views under React 19, all routes served by `next start`/`next dev`, every referenced chunk/CSS asset, compiled CSS tokens, and the adapter's presence in the client bundle. A human pass on the preview URL is still recommended.
2. **Next build still routes through React Router internally** (the compatibility adapter). Navigation under Next is client-side per link; deep links work through the 31 App Router shells. Full per-route App Router ownership is Phase 0.2 work.
3. **`next build` rewrote `tsconfig.json` on its first run** (`jsx: "react-jsx"`, `.next/dev/types` include). Those mandatory changes are committed, so later builds no longer rewrite the file.
4. **`bun.lock` / `bun.lockb` are stale.** Delete or regenerate when the team standardises on one package manager.
5. **ESLint has 6 remaining fast-refresh warnings** (pre-existing pattern of exporting hooks from component files). Not errors; no behaviour impact.

## 9. Rollback

Unchanged and proven: `npm run dev` (Vite, port 8080) and `npm run build` still work with the same source. To return fully to Phase 0, revert `package.json`/`package-lock.json` to the Next 14 versions and delete the new `src/app` shells — no view, component, style, asset, schema, or test logic depends on the upgrade.

## 10. Not done (by instruction)

No authentication work, no Neon/Drizzle, no page redesign, no design-token changes, no route table changes in `src/App.tsx`, no deletion of the Vite app.

**Awaiting approval before Phase 0.2.**
