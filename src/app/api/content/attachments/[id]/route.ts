import { NextResponse } from "next/server";

import { isContentFailure, removeAttachmentForCurrentUser } from "@/server/features/content";
import { failure, writeResponse } from "@/server/features/content/http";

/**
 * `DELETE /api/content/attachments/[id]` — remove a document record.
 *
 * Uploader only. Metadata removal and durable deletion authorization commit
 * together. Server attempts cleanup; repeated ID requests and the owner cleanup
 * endpoint retry failures without reauthorizing arbitrary paths.
 */
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const result = await removeAttachmentForCurrentUser(id);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data as { status: string });
}
