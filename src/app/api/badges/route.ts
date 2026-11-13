import { NextResponse } from "next/server";
import { getBadges } from "@/server/features/badges";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return NextResponse.json({
      data: await getBadges(
        new URL(request.url).searchParams.get("uid") ?? undefined,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "invalid_uid"
            ? "invalid_uid"
            : "unavailable",
      },
      {
        status:
          error instanceof Error && error.message === "invalid_uid" ? 400 : 503,
      },
    );
  }
}
