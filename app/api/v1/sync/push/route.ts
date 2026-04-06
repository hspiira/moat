import { NextRequest, NextResponse } from "next/server";

import { createSyncStubResponse, validateSyncPushRequest } from "@/lib/sync/server-contract";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const syncRequest = validateSyncPushRequest(body);

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid sync payload.",
      },
      { status: 400 },
    );
  }
}
