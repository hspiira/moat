import { NextRequest, NextResponse } from "next/server";

import { pullHostedSyncChanges, validateSyncPullRequest } from "@/lib/sync/hosted-store";
import { validateSyncBearerToken } from "@/lib/sync/server-contract";

export async function POST(request: NextRequest) {
  try {
    validateSyncBearerToken(request.headers.get("authorization"));

    const body = await request.json();
    const syncRequest = validateSyncPullRequest(body);

    if (process.env.MOAT_ENABLE_SYNC_STUB === "true") {
      return NextResponse.json({
        syncedAt: new Date().toISOString(),
        records: [],
      });
    }

    if (process.env.MOAT_ENABLE_SYNC_BACKEND !== "true") {
      return NextResponse.json(
        {
          error: "Hosted sync backend is not enabled in this environment.",
          contract: "/api/v1/sync/pull",
        },
        { status: 501 },
      );
    }

    return NextResponse.json(await pullHostedSyncChanges(syncRequest));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid sync pull payload.";
    const isAuthError = message.toLowerCase().includes("bearer token");

    return NextResponse.json(
      {
        error: message,
      },
      { status: isAuthError ? 401 : 400 },
    );
  }
}
