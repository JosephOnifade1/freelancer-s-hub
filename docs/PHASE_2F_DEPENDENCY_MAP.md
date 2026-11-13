# Phase 2F — mandatory preflight and dependency audit

## Preflight

- Dedicated Arena branch `arena/999f6900-freelancer-s-hub` at base `0e64f9ffefecdbb1c5f837d5bca80a0aa168059f`; initially clean.
- `gh pr view 31` reports MERGED into `migration/nextjs-app-router`, merge commit matches HEAD.
- Checkout is shallow. Fetched migration branch history (no checkout/reset), then confirmed `637e03ab23131e5f914f1a141720216889513f30` is an ancestor.
- Phase 2E schema/social service and posts.communityId FK are present. Journal contains 0000 identity, 0001 content, 0002 signed scores, 0003 social graph.
- Arena already supplies a dedicated new working branch from the merged base. All work remains on it; no additional branch is created.

## Actual legacy behavior

- Leads: public reads including closed rows; own authenticated creation/updates; types Bounty/Project/Retainer/Full-time, statuses open/in-progress/closed. No lead privacy column, hard-delete policy, edit UI, or archive API. Moderation closes leads rather than deleting. No numeric bidding fields: budget is text plus currency; proposal is free text.
- `applications.ts`: own application lookup, submit, withdrawn-row reactivation with new proposal, owner inbox, sent inbox, accept/reject/reset-pending review and applicant withdrawal. Unique (leadId,applicantUid); applicant cannot apply to own or non-open lead. Count includes pending/accepted/rejected but excludes withdrawn. Existing application profile hydration is N+1, and sent/received views also make unnecessary lead requests.
- RLS restricts application reads to applicant or lead owner; staff have no blanket access. Update trigger separates immutable commercial identity/proposal from review state. Trigger permits an owner to resurrect a withdrawn application: tighten that inconsistency so only its applicant can reapply and only while the lead is open.
- `lead_pipeline` is an **independent per-user private prospect tracker**, NOT an application board. Manual items have nullable leadId; saved opportunities have unique (userUid,leadId). Stages new/conversation/proposal/negotiation/won, arbitrary user-controlled movement; updatedAt ordering. No applicationId, auto-initialization on applying, bid column, or acceptance-to-stage mapping exists. Do not invent them. Review outcomes and tracking stage describe different facts; acceptance must not rewrite another user's private tracker.
- Pipeline supports list/add/save/stage-change/delete. Client-supplied userUid currently relies on RLS; replace with verified server identity.

## Runtime dependency map

- Libraries: `leads.ts`, `applications.ts`, `pipeline.ts` plus lead preview in `reports.ts`.
- UI: LeadBoard, LeadDetail, CreateLead, Applications, Pipeline, LeadCard and Landing lead listings where present. Global search currently includes people/posts only; lead discovery filters are in LeadBoard. Do not redesign global search.
- Report records and `moderate_report` remain Supabase. Lead preview must use Neon; the lead-close side effect must no longer target an obsolete Supabase lead row. Preserve report-record mutation through the existing RPC, isolate the necessary Neon lead closure behind staff authorization; do not migrate report records.
- Supabase application notification triggers cannot observe Neon mutations. Notifications remain out of scope; document delivery boundary rather than dual-writing applications or pretending the trigger migrated.
- Shared mock has legacy lead/pipeline fixtures used by uxPersistence tests. Migrate those tests to an API boundary fixture, keeping their persistence/isolation assertions; production lead workflows have no mock/localStorage fallback.

## Implementation/verification plan

Add three coherent Drizzle tables, ordered migration and pure injectable queries; server-only verified-session service; API/client adapters preserving existing signatures; batched public-profile SQL hydration. Serialize application lifecycle/count changes by locking the lead first, then the application. Pipeline writes are single owner-scoped SQL operations. Test real local PostgreSQL races/rollback and hermetic route/security/client boundaries. Run both builds, full suites and production HTTP smoke. No real Neon credentials required or claimed; no seed users/admin, main changes or PR.
