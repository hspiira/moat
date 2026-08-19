"use client";

const KEY_VAULT_STATE_KEY = "moat.key-vault-state";

// What happened locally that the published vault does not yet know about.
export type KeyVaultDrift = "passkey-added" | "passkey-removed" | "key-discarded";

export type KeyVaultState = {
  publishedAt?: string;
  drift?: KeyVaultDrift;
};

const empty: KeyVaultState = {};

function isDrift(value: unknown): value is KeyVaultDrift {
  return value === "passkey-added" || value === "passkey-removed" || value === "key-discarded";
}

export function readKeyVaultState(): KeyVaultState {
  if (typeof window === "undefined") {
    return empty;
  }

  try {
    const raw = window.localStorage.getItem(KEY_VAULT_STATE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as Partial<KeyVaultState>;
    return {
      publishedAt: typeof parsed.publishedAt === "string" ? parsed.publishedAt : undefined,
      drift: isDrift(parsed.drift) ? parsed.drift : undefined,
    };
  } catch {
    return empty;
  }
}

function write(state: KeyVaultState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_VAULT_STATE_KEY, JSON.stringify(state));
}

export function recordKeyVaultPublished(publishedAt: string = new Date().toISOString()): void {
  write({ publishedAt });
}

// Nothing to drift from until a vault has actually been published, so a change
// on a device that never published one is not worth nagging about.
export function markKeyVaultDrift(drift: KeyVaultDrift): void {
  const current = readKeyVaultState();
  if (!current.publishedAt) return;
  write({ ...current, drift });
}

export function clearKeyVaultDrift(): void {
  const current = readKeyVaultState();
  if (!current.drift) return;
  write({ publishedAt: current.publishedAt });
}

export function forgetKeyVaultState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_VAULT_STATE_KEY);
}
