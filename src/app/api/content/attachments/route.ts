import { NextResponse } from "next/server";

import {
  createAttachmentForCurrentUser,
  getAttachments,
  isContentFailure,
} from "@/server/features/content";
import { failure, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * Document metadata.
 *
 * `GET  /api/content/attachments?postId=…` — metadata for a visible, non-deleted post.
 * `POST /api/content/attachments` — record an upload that already exists in Storage.
 *
 * **This route does not upload bytes.** The file is written to Supabase Storage by
 * the browser (`attachments.ts`), and only the resulting path is registered here.
 * Storage is unchanged this phase (Phase 2D §8); the split is what keeps the metadata
 * authorized while the bytes stay where they are.
 *
 * The server re-derives ownership from the session and rejects a `storagePath` that
 * does not begin `<uid>/<postId>/`, so a caller cannot register a file in someone
 * else's folder.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const postId = new URL(request.url).searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const result = await getAttachments(postId);
  if (isContentFailure(result)) return failure(result.reason);
  return NextResponse.json({ attachments: result.data });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const postId = String(body.postId ?? "");

  if (!postId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const result = await createAttachmentForCurrentUser(postId, {
    storagePath: String(body.storagePath ?? ""),
    fileName: String(body.fileName ?? ""),
    mimeType: String(body.mimeType ?? ""),
    fileSize: Number(body.fileSize ?? 0),
  });

  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data as { status: string });
}
