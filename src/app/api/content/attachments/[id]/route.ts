import { NextResponse } from "next/server";

import { isContentFailure, removeAttachmentForCurrentUser } from "@/server/features/content";
import { failure, writeResponse } from "@/server/features/content/http";

/**
 * `DELETE /api/content/attachments/[id]` — remove a document record.
 *
 * Uploader only, enforced in the `where` clause. Storage cleanup is the client's
 * follow-up (`removePostAttachment` removes metadata first, then the object, so a
 * failed cleanup cannot leave a broken link).
 */
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const result = await removeAttachmentForCurrentUser(id);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data as { status: string });
}
