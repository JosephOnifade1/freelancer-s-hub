import { NextResponse } from "next/server";
import {
  getAttachmentDownload,
  isContentFailure,
} from "@/server/features/content";
import { failure } from "@/server/features/content/http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const result = await getAttachmentDownload((await context.params).id);
  if (isContentFailure(result)) return failure(result.reason);
  return NextResponse.json(
    { url: result.data },
    { headers: { "cache-control": "private, no-store" } },
  );
}
