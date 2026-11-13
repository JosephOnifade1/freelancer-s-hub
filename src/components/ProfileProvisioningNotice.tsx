"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth-context";
import { provisioningMessage } from "@/lib/provisioning-state";

/**
 * Tells a signed-in user that their application profile is not ready yet.
 *
 * Phase 2B.4. Renders **only** in the recoverable state: signed in, with a valid
 * Supabase session, whose Neon profile could not be created. It is not an error
 * dialog and not a redirect — the user is genuinely signed in, and almost
 * everything they can do does not need a profile row.
 *
 * Placement mirrors the existing demo-mode notice in `AppLayout` (a bordered
 * strip inside `<main>`, above the breadcrumbs) and reuses the design-system
 * `Alert`/`Button` rather than introducing new presentation.
 *
 * Deliberately says nothing about databases, HTTP status codes or internals: the
 * server already refuses to leak driver detail, and the client has nothing more
 * useful to add.
 */
export function ProfileProvisioningNotice() {
  const { user, provisioning, retryProvisioning } = useAuth();

  // Only for a signed-in user whose profile failed. `pending` renders nothing:
  // a brief wait is not a problem to report, and flashing a warning during
  // normal sign-in would be worse than saying nothing.
  if (!user || provisioning.status !== "failed") return null;

  return (
    <Alert className="mb-4 border-warning/50 bg-warning/10 py-3" data-testid="profile-provisioning-notice">
      <AlertTriangle className="h-4 w-4" />
      <div className="flex flex-wrap items-start justify-between gap-3 pl-7">
        <div>
          <AlertTitle className="text-sm font-semibold">
            Your profile isn&rsquo;t ready yet
          </AlertTitle>
          <AlertDescription className="text-[11px] text-muted-foreground">
            {provisioningMessage(provisioning.reason)} You can carry on browsing and retry whenever you like.
          </AlertDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={retryProvisioning}
          className="h-7 shrink-0 gap-1.5 px-2.5 text-[11px]"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    </Alert>
  );
}
