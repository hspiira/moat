import { normalizeEndpoint } from "@/lib/sync/transport";

export type SignInResult =
  | { status: "ok"; userId: string; isNewUser: boolean; syncAuthToken: string }
  | { status: "refused"; message: string; nextStep?: string };

// The refusals a person can act on, said in words rather than a status code. A
// ledger is never merged, so the way onto an account that already has one is to
// restore its backup here.
function refusalFor(
  status: number,
  serverMessage: string | undefined,
): { message: string; nextStep?: string } {
  if (status === 409) {
    return {
      message: serverMessage ?? "That account already syncs a different ledger.",
      // Two ledgers are never merged, so the way onto that account is to bring
      // its own records here, which carries the key with them.
      nextStep:
        "To use that account on this device, restore its encrypted backup here instead. That brings its records and the key that opens them.",
    };
  }
  if (status === 429) {
    return { message: "Too many sign-in attempts. Try again shortly." };
  }
  if (status === 401) {
    return { message: "Google could not confirm that sign-in. Try again." };
  }
  return { message: "Sign-in could not be completed." };
}

export async function completeGoogleSignIn(params: {
  endpoint: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  nonce: string;
  proposedUserId?: string;
  existingAuthToken?: string;
  client?: "web" | "ios";
}): Promise<SignInResult> {
  let response: Response;
  try {
    response = await fetch(`${normalizeEndpoint(params.endpoint)}/v1/auth/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Proof that a ledger already syncing on this device is this device's, so
        // adding a Google account to it is not refused as someone else's.
        ...(params.existingAuthToken?.trim()
          ? { Authorization: `Bearer ${params.existingAuthToken.trim()}` }
          : {}),
      },
      body: JSON.stringify({
        provider: "google",
        client: params.client ?? "web",
        code: params.code,
        codeVerifier: params.codeVerifier,
        redirectUri: params.redirectUri,
        nonce: params.nonce,
        proposedUserId: params.proposedUserId,
      }),
    });
  } catch {
    return {
      status: "refused",
      message: "The sync server could not be reached.",
      nextStep: "Check the connection and try again from Settings.",
    };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return { status: "refused", ...refusalFor(response.status, body.error) };
  }

  const body = (await response.json()) as {
    userId?: unknown;
    isNewUser?: unknown;
    syncAuthToken?: unknown;
  };

  if (typeof body.userId !== "string" || typeof body.syncAuthToken !== "string") {
    return { status: "refused", message: "The sync server sent back an answer this app cannot use." };
  }

  return {
    status: "ok",
    userId: body.userId,
    isNewUser: body.isNewUser === true,
    syncAuthToken: body.syncAuthToken,
  };
}
