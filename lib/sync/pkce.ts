const VERIFIER_BYTES = 32;

function base64Url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomUrlToken(bytes = VERIFIER_BYTES): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export type SignInStart = {
  authorizeUrl: string;
  verifier: string;
  nonce: string;
  state: string;
};

// PKCE, so the code is useless to anyone who intercepts it without the verifier
// this device keeps. The nonce ties the identity token to this attempt and the
// state ties the redirect back to it.
export async function startGoogleSignIn(params: {
  clientId: string;
  redirectUri: string;
}): Promise<SignInStart> {
  const verifier = randomUrlToken();
  const nonce = randomUrlToken(16);
  const state = randomUrlToken(16);

  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", params.clientId);
  authorize.searchParams.set("redirect_uri", params.redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email");
  authorize.searchParams.set("code_challenge", await codeChallengeFor(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("state", state);
  // Without this Google skips the account chooser for anyone already signed in,
  // which is wrong when the whole point is choosing which account holds a ledger.
  authorize.searchParams.set("prompt", "select_account");

  return { authorizeUrl: authorize.toString(), verifier, nonce, state };
}

export type SignInRedirect = { code: string; state: string };

export function readSignInRedirect(search: string): SignInRedirect | { error: string } {
  const params = new URLSearchParams(search);
  const error = params.get("error");
  if (error) {
    return { error: error === "access_denied" ? "Sign-in was cancelled." : "Google refused the sign-in." };
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return { error: "That sign-in link is incomplete." };

  return { code, state };
}
