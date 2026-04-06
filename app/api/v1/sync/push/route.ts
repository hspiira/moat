import { NextRequest, NextResponse } from "next/server";

import { applyHostedSyncPush } from "@/lib/sync/hosted-store";
import {
  createSyncStubResponse,
  validateSyncBearerToken,
  validateSyncPushRequest,
} from "@/lib/sync/server-contract";

export async function POST(request: NextRequest) {
  try {
    validateSyncBearerToken(request.headers.get("authorization"));

    const body = await request.json();
    const syncRequest = validateSyncPushRequest(body);

    if (process.env.MOAT_ENABLE_SYNC_BACKEND === "true") {
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
