# Dependency remediation assessment — separate approval required

No dependency ranges or lockfile entries were changed during Phase 2I-B.1.
`npm ci --ignore-scripts --no-audit --no-fund` installed the existing lock only.
The following versions/advisories were confirmed by reading the lockfile and
performing a read-only npm advisory-bulk lookup. Candidate publication and relevant
peer/engine metadata were separately checked against npm. These are candidates
outside the returned advisory ranges, not a claim of universally vulnerability-free
packages, successful upgrades, or completed compatibility validation.

## Proposed changes

| Package | Locked version | Confirmed critical/high advisories | Patched candidate and compatibility | Change and required regressions |
|---|---|---|---|---|
| DOMPurify | 3.4.12 | GHSA-cg2g-xh64-v4q7 (critical); GHSA-mrv2-3pqr-j5jr (high) | 3.4.17; satisfies direct `^3.4.1`; no peer constraints in candidate metadata | Direct dependency/lock refresh. Test editor initialization, Markdown-to-rich-text transitions, untrusted HTML, iframe policy, paste/sanitization and all editor suites. Special template/DOM-output and in-place-hook exploit prerequisites are not present in inspected calls, but do not use this to dismiss the advisories. |
| Tinypool | 1.1.1 | GHSA-5gmw-xhrv-c9v3; GHSA-85c8-ppgw-ccpr (critical) | 2.1.2; Node `^20 || >=22`; **not compatible with Vitest 3.2.7's `^1.1.1` dependency** | Transitive through Vitest. Do not force a major override as an assumed-compatible patch. Approve a coordinated test-runner migration or investigate a maintained 1.x backport. Current Vitest 5.1.0 metadata no longer lists Tinypool, but raises Node requirement to `^22.12 || ^24 || >=26` and has Vite 6.4/7/8 peers; this is a separate migration, not a drop-in recommendation. Run every test config, workers/pools, module mocks, jsdom, PGlite, coverage integrations, CI and engine checks. |
| Tiptap core | 3.29.0 | GHSA-j95f-988m-3j2f (high) | 3.30.5; candidate requires `@tiptap/pm` **exactly 3.30.5** | Core is transitive through starter-kit, but direct Tiptap dependencies/peers must move together. Current React and extension peers require exact 3.29.0. Approve coordinated Tiptap-family resolution, not core-only override. Test Markdown pathological input/ReDoS, roundtrip serialization, paste, images, tables, selections and all editor behavior. |
| ProseMirror view | 1.42.2 | GHSA-c8x8-7fp4-3x9w (high) | 1.42.3; no candidate peer dependency; satisfies inspected parent ranges, including `@tiptap/pm`'s `^1.41.9` | Transitive lock refresh after Tiptap alignment. Test hostile clipboard content/paste XSS, editor rendering, selection and browser paste/drop. |
| brace-expansion | 1.1.16 and 5.0.8 | GHSA-mh99-v99m-4gvg; GHSA-rgw5-rvv9-x895; GHSA-qhr7-859c-m2p7; GHSA-6j4f-fj2g-mc7p (high; ranges differ by line) | 1.1.20 and 5.0.11 respectively; 5.x candidate requires Node 20 or >=22; no candidate peers | Transitive through minimatch and TypeScript ESLint's nested minimatch. Candidates fit `^1.1.7` / `^5.0.5`. Refresh both lock locations. Test bounded pathological brace patterns, ESLint/config discovery and build/test globs. |
| js-yaml | 4.3.0 | GHSA-5p4m-2wfm-xmqj; GHSA-2883-xcg3-v3hh (high) | 4.3.2; fits `@eslint/eslintrc`'s `^4.3.0`; no candidate peers | Transitive lock refresh. Test ESLint config parsing, YAML merges/omap adversarial fixtures and lint. No application YAML-upload endpoint identified. |
| nanoid | 3.3.16 | GHSA-2v37-7h3g-55p8 (high) | 3.3.18; fits PostCSS `^3.3.16`; no candidate peers; supports the current modern Node line | Transitive lock refresh. Test zero-size/custom-generator termination with time bounds, CSS pipeline and production builds. No direct Borynx custom-generator call identified. |
| source-map-js | 1.2.1 | GHSA-68fv-2mgg-jv7q (high) | 1.2.2; fits PostCSS `^1.2.1`; no candidate peers | Transitive lock refresh. Test hostile indexed-map offsets with time bounds, source-map generation/consumption and CSS/Next/Vite builds. |
| Vite | 5.4.21 | GHSA-587h-7wmj-h5pm (high) | 6.4.4; **outside root `^5.4.19`**. Candidate Node `^18 || ^20 || >=22`; relevant Node types, optional preprocessor/minifier peers must be validated | Direct major-version change plus lock. Installed React SWC plugin 3.11.0 accepts Vite 4/5/6/7; lovable-tagger 1.3.3 accepts >=5 <9; existing Vitest/vite-node ranges accept 6. Coordinate with Tinypool runner decision. Test Windows launch-editor denial/injection regression, dev host/origin enforcement, /api proxy, legacy dev/preview/build, HMR and every Vitest config. |

## Relationship to authentication

These packages are not ordinary required runtime dependencies of Better Auth's
Drizzle adapter. Better Auth has an optional Vitest peer, and the project already
uses Vitest; that associates the test graph with Tinypool/Vite and can affect npm
meta-vulnerability classification. It does not mean Better Auth authentication
executes Tinypool workers in production.

DOMPurify, Tiptap and ProseMirror are real application editor dependencies. The
other paths are principally lint/build/test tooling; tooling code execution and
DoS still matter, particularly for untrusted PRs or exposed development servers.

## Approval sequence

1. Approve the compatible patch/transitive group separately, with lockfile review.
2. Approve coordinated Tiptap-family updates and editor/browser regressions.
3. Decide Node/test-runner/Vite migration together; do not force incompatible
   Tinypool major versions through overrides without evidence.
4. Re-run a complete audit after resolution: parent/meta findings and advisory
   databases can differ from this direct bulk lookup. Retest build/test/bundle
   boundaries. No automatic audit fix and no release-readiness claim here.
