export type GoogleClientKind = "web" | "ios";

export type GoogleClient = {
  kind: GoogleClientKind;
  clientId: string;
  // A native app cannot keep a secret, so Google issues none for an iOS client.
  // PKCE is what stands in its place, which is why the verifier is required.
  clientSecret?: string;
};

export function readGoogleClient(
  kind: GoogleClientKind,
  env: Record<string, string | undefined> = process.env,
): GoogleClient {
  if (kind === "ios") {
    const clientId = env.MOAT_OIDC_GOOGLE_IOS_CLIENT_ID?.trim();
    if (!clientId) {
      throw new Error("MOAT_OIDC_GOOGLE_IOS_CLIENT_ID is not set, so the app cannot sign in.");
    }
    // A client is registered as one type or the other, so the same id in both
    // places means the web one was reused. Google would refuse the app's custom
    // scheme, and the reason it gives names the client type rather than the
    // setting, which is a long way from the mistake.
    if (clientId === env.MOAT_OIDC_GOOGLE_CLIENT_ID?.trim()) {
      throw new Error(
        "MOAT_OIDC_GOOGLE_IOS_CLIENT_ID is the web client id. The app needs its own iOS client.",
      );
    }
    return { kind, clientId };
  }

  const clientId = env.MOAT_OIDC_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.MOAT_OIDC_GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId) throw new Error("MOAT_OIDC_GOOGLE_CLIENT_ID is not set.");
  if (!clientSecret) throw new Error("MOAT_OIDC_GOOGLE_CLIENT_SECRET is not set.");
  return { kind, clientId, clientSecret };
}

// Google's own scheme for a native redirect: the client id read backwards, so
// only the app registered under it can be sent the code.
export function iosRedirectScheme(clientId: string): string {
  const withoutSuffix = clientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${withoutSuffix}`;
}

export function isIosRedirect(redirectUri: string, clientId: string): boolean {
  return redirectUri.startsWith(`${iosRedirectScheme(clientId)}:/`);
}
