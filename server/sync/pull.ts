import { NextRequest, NextResponse } from "next/server";

import { pullHostedSyncChanges, validateSyncPullRequest } from "@/lib/sync/hosted-store";
import { isHostedBackendUsable, validateSyncBearerToken } from "@/lib/sync/server-contract";

// DEV-ONLY BACKEND. See the note in ./../push/route.ts — the hosted store is
// a development stand-in, not a production sync service.

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

    if (!isHostedBackendUsable()) {
      return NextResponse.json(
        { error: "Hosted sync backend requires MOAT_SYNC_BEARER_TOKEN to be set." },
        { status: 503 },
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
