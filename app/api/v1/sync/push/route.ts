import { NextRequest, NextResponse } from "next/server";

import { applyHostedSyncPush } from "@/lib/sync/hosted-store";
import {
  createSyncStubResponse,
  isHostedBackendUsable,
  validateSyncBearerToken,
  validateSyncPushRequest,
} from "@/lib/sync/server-contract";

// DEV-ONLY BACKEND. The hosted store behind MOAT_ENABLE_SYNC_BACKEND is a
// single-process JSON file with shared-token auth and no per-user tenancy.
// It exists to exercise the sync contract in development and must not be
// enabled for real users. Default behavior (both flags unset) is 501.

export async function POST(request: NextRequest) {
  try {
    validateSyncBearerToken(request.headers.get("authorization"));

    const body = await request.json();
    const syncRequest = validateSyncPushRequest(body);

    if (process.env.MOAT_ENABLE_SYNC_BACKEND === "true") {
      if (!isHostedBackendUsable()) {
        return NextResponse.json(
          { error: "Hosted sync backend requires MOAT_SYNC_BEARER_TOKEN to be set." },
          { status: 503 },
        );
      }
      return NextResponse.json(await applyHostedSyncPush(syncRequest));
    }

    if (process.env.MOAT_ENABLE_SYNC_STUB !== "true") {
      return NextResponse.json(
        {
          error: "Hosted sync backend is not enabled in this environment.",
          contract: "/api/v1/sync/push",
          acceptedItems: syncRequest.items.length,
        },
        { status: 501 },
      );
    }

    return NextResponse.json(createSyncStubResponse(syncRequest));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid sync payload.";
    const isAuthError = message.toLowerCase().includes("bearer token");
    return NextResponse.json(
      {
        error: message,
      },
      { status: isAuthError ? 401 : 400 },
    );
  }
}
