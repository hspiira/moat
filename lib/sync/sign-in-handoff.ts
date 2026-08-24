const KEY = "moat.sign-in-attempt";

export type SignInAttempt = {
  verifier: string;
  nonce: string;
  state: string;
  redirectUri: string;
  endpoint: string;
  proposedUserId?: string;
  existingAuthToken?: string;
};

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): Store | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// The attempt lives for one redirect, so sessionStorage rather than local: a
// verifier left behind in a shared browser is a code someone else could spend.
export function rememberSignInAttempt(attempt: SignInAttempt, store: Store | null = sessionStore()) {
  try {
    store?.setItem(KEY, JSON.stringify(attempt));
  } catch {
    // A browser refusing storage means the redirect cannot be completed. The
    // callback says so rather than failing silently here.
  }
}

export function takeSignInAttempt(store: Store | null = sessionStore()): SignInAttempt | null {
  try {
    const raw = store?.getItem(KEY);
    store?.removeItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SignInAttempt>;
    if (
      typeof parsed.verifier !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.state !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.endpoint !== "string"
    ) {
      return null;
    }

    return {
      verifier: parsed.verifier,
      nonce: parsed.nonce,
      state: parsed.state,
      redirectUri: parsed.redirectUri,
      endpoint: parsed.endpoint,
      proposedUserId:
        typeof parsed.proposedUserId === "string" ? parsed.proposedUserId : undefined,
      existingAuthToken:
        typeof parsed.existingAuthToken === "string" ? parsed.existingAuthToken : undefined,
    };
  } catch {
    return null;
  }
}

// Without this a code from an attempt nobody on this device started would be
// accepted, which is what makes the state parameter worth sending at all.
export function matchesAttempt(attempt: SignInAttempt | null, returnedState: string): boolean {
  return attempt !== null && attempt.state.length > 0 && attempt.state === returnedState;
}
