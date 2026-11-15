# Local login, demo accounts and homepage corrections

## Fixed

- `/` now selects the existing marketing landing for guests and the existing feed for signed-in users. A loading state holds while identity resolves.
- Auth connection errors no longer hide the entire public application. A retry notice is shown; private guards block content while identity cannot be verified.
- Local-development Login no longer silently hides missing demo configuration. Discovery reports setup failures and checks exact verified seed provenance before enabling each one-click account button. Password checking, normal sessions, roles, origin checks and POST rate limits remain intact. Discovery never seeds anything.
- Login, Signup and Forgot Password explain file/disabled delivery. File delivery does **not** send inbox email: private messages are in `.local/auth-outbox` on the server computer. No endpoint exposes those files or their tokens.
- Disabled email delivery rejects email-dependent requests before signup can create another unverified account. A configured gateway can still fail at runtime; configuration readiness is not delivery confirmation.
- Unverified login reports the verification error without automatically sending another email; explicit resend remains available. Email verification is still required.
- Added a generic App Router error boundary with retry/home actions; raw server errors are not displayed.

## What the owner must do locally

These changes do not reset or seed the database, recover old verification tokens, or configure an email service.

1. Follow **NEON_OWNER_SETUP.md** for your existing disposable Neon database. Use `npm run dev:next` (not the legacy Vite command) and the exact loopback `BETTER_AUTH_URL`, normally `http://localhost:3000`.
2. For local file delivery, use `NODE_ENV=development` (Next dev sets this), `BORYNX_ENVIRONMENT=development`, `EMAIL_DELIVERY_MODE=file`, and a loopback `BETTER_AUTH_URL`. Restart the dev server after config changes. Request verification again, then open the newest matching JSON message privately under `.local/auth-outbox` and follow its `url`. Never share that file or commit it. For actual inbox mail, configure the documented HTTPS email gateway instead.
3. Demo buttons additionally require the explicit designated-database flags, `BORYNX_ENABLE_DEMO_LOGIN=true`, a consistent `BORYNX_DEMO_PASSWORD` of at least 20 characters, migrations, and the owner's explicit seed command described in the guide. Setup does not happen just by enabling the UI. Click **Recheck setup** after completing it.
4. Unprovenanced existing accounts are not adopted as demo identities. Do not bypass that check or disable verification. The optional disposable reset remains a separate, owner-approved operation.

## Route review and validation

- Application suite: **396 passing tests** (42 files).
- Auth suite: **108 passing tests** (10 files). Embedded PGlite/mocks only; no PostgreSQL sockets or provider calls.
- Root and auth TypeScript checks pass. Lint: zero errors, six existing refresh warnings.
- Webpack Next production build passed, including all route compilation and static page generation.
- Anonymous HTTP smoke against the production build, with an explicitly empty service environment: **40/40 page routes** returned expected status (25 public shells HTTP 200; 15 private routes HTTP 307 to login). Dynamic routes used synthetic segments. This is **shell/redirect validation**, not proof of hydrated views, database records, private roles or successful email/Google/storage integrations.
- New regression tests cover guest/feed selection, loading/outage behavior, file/disabled email messaging, demo setup/missing provenance, exact readiness mapping, production/remote demo hiding, origin-enforced email preflight and page access classification.
- No dependency/lockfile or migration changes, no live database/provider operations, no reset/seed and no deployment.

No pages were deleted. `/b`, `/p`, `/f`, `/u` are intentional compatibility redirects; pricing/status and other placeholders remain linked routes, not proven dead code. Removing them would introduce broken links. Authenticated browser-level checks with configured data remain outstanding; no claim that every possible page state or future error is eliminated.
