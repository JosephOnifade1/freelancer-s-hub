# Borynx — Freelancer Community Platform

## Current ownership (Phase 2H)

**Neon PostgreSQL + Drizzle** owns all application records and relationships:
profiles/handles, content/comments/votes/polls/bookmarks/document metadata,
communities/memberships/follows, leads/applications/private pipeline,
notifications/reports/moderation and badges/earned badges.
**Supabase Auth** owns accounts, OAuth, email/password flows, tokens and sessions.
**Supabase Storage** owns uploaded bytes, not application visibility or relationships.

## Setup / deployment

1. Configure Supabase Auth URL/anon key and OAuth/email redirect URLs. Use the
   NEXT_PUBLIC_* pair for Next, VITE_* for the retained browser build; see `.env.example`.
2. Configure server-only DATABASE_URL for Neon. Apply the ordered Drizzle migrations
   0000–0006 (`npm run db:migrate` on a development database; use verified TLS and
   an operator-reviewed deployment runner in production). Never rewrite applied migrations.
3. For private documents, configure server-only SUPABASE_SERVICE_ROLE_KEY on the
   Next backend. It is isolated in `src/server/storage/documents.ts` for object
   verification/signing **after Neon authorization**. Never put it in public variables.
4. Operator-review/apply `ops/supabase_storage_neon_cutover.sql` to Supabase Storage.
   It removes legacy policies consulting Supabase application tables, keeps the
   bucket private, permits own-folder upload/read/delete for cleanup, and leaves
   other-viewer download decisions to the Neon-authorized server signer. Inspect
   ALL other bucket policies (RLS policies OR together). This has NOT been applied
   or verified against a real Supabase project in this phase.
5. Retain existing avatar/post-image buckets and own-folder byte policies. Preserve
   the operator-controlled Neon admin bootstrap; no automatic admin/seed account.

**Do not run the historical root `supabase_*migration.sql`/`supabase_schema.sql`
as the application setup.** They remain provenance/export mappings, not runtime
prerequisites; some install obsolete Auth->public.profiles triggers. Existing
projects must operator-review legacy Auth trigger retirement at cutover; the
application provisions Neon idempotently from verified Auth identity, never dual-writes.
Do not drop legacy tables/data without separate authorization and backup.

No browser mock database/auth or shared demo account remains in the runtime.
Deprecated demo flags only warn. Historical mocks live exclusively under test fixtures.
Badge catalog rows are migrated, not users or earned awards. Progress is computed
from existing UI inputs; there is no public award endpoint or new award automation.

The retained Vite frontend requires the Next API backend. Dev/preview proxies
same-origin `/api` to `BORYNX_API_PROXY_TARGET` (default server-side port 3000).
For static deployments, route `/api` to that backend at the reverse proxy; do not
send database credentials or browser requests to localhost. Vite is a UI rollback,
not a rollback to Supabase Database.

Read `docs/PHASE_2H_AUDIT.md` and the Phase 2H completion report for consistency,
historical transfer assessment, checks and Phase 2I deployment requirements.

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

### Next.js 16 App Router (migration track)

Two front ends live side by side on this branch: the original **Vite + React
Router** app (default scripts, full rollback) and the **Next.js 16 App Router**
migration track.

| Script | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm run preview` | Vite app (port 8080) — the fallback |
| `npm run dev:next` | `next dev --turbopack -H 0.0.0.0 -p 3000` |
| `npm run build:next` / `npm run start:next` | Next 16 production build (Turbopack) |
| `npm run build:next:webpack` / `npm run dev:next:webpack` | Webpack escape hatch for the Next build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config; `next lint` no longer exists in Next 16) |
| `npm test` | Vitest suite |
| `node scripts/server-smoke.mjs` | Route/asset/style smoke checks against a running Next server |

### Route parity

Both front ends must serve the same URLs. `src/lib/route-parity.ts` is the
inventory, and `src/test/phase02-interaction.test.tsx` fails if `src/app` gains or
loses a page without updating it. Redirect-only aliases (`/b`, `/p`, `/f`, `/u`,
`/following`) exist on both sides.

### Navigation: Next.js is the canonical runtime

**Phase 0.5 froze the Vite app as a legacy rollback snapshot.** The App Router is
the only active development target. New code imports navigation natively:

```ts
import Link from "next/link";
import { useRouter, usePathname, useParams, useSearchParams } from "next/navigation";
```

Do not add React Router imports or dual-runtime abstractions to new code, and do
not require Vite compatibility for new features.

Still on the compatibility adapter (`src/lib/navigation.tsx`), pending later
phases: `Link` with React Router `state=` (the `/login` redirect bridge) in
`Communities`, `ComposerBar`, `PollWidget`, `Profile`, `LeadsBoard`,
`CommunityDetail`, `LeadDetail`, `PostDetail`; the auth surface (`Login`,
`Signup`, `ProtectedRoute`); and `AppLink`, which keeps the rollback snapshot
working. See `docs/PHASE_0.5_VITE_EXIT.md`.

### Running the legacy rollback snapshot

The frozen Vite app is preserved but not maintained. It still builds and runs:

```bash
npm run dev:legacy       # vite dev server on :8080
npm run build:legacy     # production build to dist/
npm run preview:legacy   # serve the built snapshot on :8080
npm run typecheck:legacy # typecheck against the legacy next/* shims
```

It needs no `next/*` compatibility work: `src/legacy-next/` provides the
`next/navigation` and `next/link` surface the snapshot calls, wired in through
`vite.config.ts`, `vitest.config.ts` and `tsconfig.legacy.json`. Nothing there is
used by the Next.js build.

Next.js 16 uses Turbopack by default, so the React Router compatibility alias is
declared twice in `next.config.mjs` (`turbopack.resolveAlias` and `webpack`).
`src/lib/navigation.tsx` keeps every existing `react-router-dom` import working
under Next — components are unchanged. Under Next, set `NEXT_PUBLIC_SUPABASE_URL`
/ `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the Supabase client
reads both the `VITE_*` and `NEXT_PUBLIC_*` names.

See `docs/PHASE_0.1_NEXT16_COMPATIBILITY_AUDIT.md` and
`docs/PHASE_0.1_COMPLETION_REPORT.md` for the upgrade record.
