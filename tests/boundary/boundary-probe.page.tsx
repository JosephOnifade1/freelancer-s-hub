"use client";

import {
  echoParameterized,
  isDatabaseConfigured,
  probeDatabase,
  proveAdvisoryLock,
  proveTransaction,
} from "@/server/db";

/**
 * Deliberate, *intentional* violation of the server-only boundary (Phase 2B.1).
 *
 * This file proves the boundary is enforced rather than assumed. It is a Client
 * Component that imports the database module, so a Next.js build MUST fail while
 * it sits under `src/app/`.
 *
 * It is kept here, outside `src/app/`, precisely so the repository still builds:
 * an intentionally broken route would be a trap for the next person. Re-run the
 * proof by copying it into the app tree:
 *
 *     mkdir -p src/app/boundary-probe
 *     cp tests/boundary/boundary-probe.page.tsx src/app/boundary-probe/page.tsx
 *     npm run build:next            # must FAIL: "depends on next/headers"
 *     rm -rf src/app/boundary-probe
 *
 * Recorded result: docs/PHASE_2B_1_DRIVER_COMPATIBILITY.md §8.
 */
export function BoundaryProbe() {
  const configured = isDatabaseConfigured();
  const probe = probeDatabase;
  const tx = proveTransaction;
  const echo = echoParameterized;
  const lock = proveAdvisoryLock;
  return (
    <div>
      {String(configured)} {String(Boolean(probe && tx && echo && lock))}
    </div>
  );
}
