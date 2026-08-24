// Google refuses an OAuth screen inside an embedded web view, so the app hands
// the sign-in to the system browser and is called back through a scheme only it
// is registered for. That scheme is the client id read backwards, which is
// Google's own arrangement for native apps.
export function iosRedirectUri(iosClientId: string): string {
  const withoutSuffix = iosClientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${withoutSuffix}:/oauth2redirect`;
}

export type SignInClient = "web" | "ios";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

// The code and state arrive on a custom scheme rather than a page load, so the
// query has to be read out of the whole url.
export function readNativeCallbackUrl(url: string): string {
  const query = url.indexOf("?");
  return query === -1 ? "" : url.slice(query);
}

export function isOurCallbackUrl(url: string, iosClientId: string): boolean {
  return url.startsWith(`${iosRedirectUri(iosClientId).split(":/")[0]}:/`);
}
