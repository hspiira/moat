import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  return store;
}

describe("key vault state", () => {
  it("ignores drift on a device that never published a vault", async () => {
    stubStorage();
    const { markKeyVaultDrift, readKeyVaultState } = await import(
      "@/lib/preferences/key-vault-state"
    );

    markKeyVaultDrift("passkey-added");

    expect(readKeyVaultState()).toEqual({ publishedAt: undefined, drift: undefined });
  });

  it("remembers what the published vault does not know yet", async () => {
    stubStorage();
    const { markKeyVaultDrift, readKeyVaultState, recordKeyVaultPublished } = await import(
      "@/lib/preferences/key-vault-state"
    );

    recordKeyVaultPublished("2026-08-19T09:00:00.000Z");
    markKeyVaultDrift("passkey-added");

    expect(readKeyVaultState()).toEqual({
      publishedAt: "2026-08-19T09:00:00.000Z",
      drift: "passkey-added",
    });
  });

  it("clears drift without forgetting that a vault exists", async () => {
    stubStorage();
    const { clearKeyVaultDrift, markKeyVaultDrift, readKeyVaultState, recordKeyVaultPublished } =
      await import("@/lib/preferences/key-vault-state");

    recordKeyVaultPublished("2026-08-19T09:00:00.000Z");
    markKeyVaultDrift("passkey-removed");
    clearKeyVaultDrift();

    expect(readKeyVaultState()).toEqual({
      publishedAt: "2026-08-19T09:00:00.000Z",
      drift: undefined,
    });
  });

  it("discards everything when the vault is gone", async () => {
    stubStorage();
    const { forgetKeyVaultState, readKeyVaultState, recordKeyVaultPublished } = await import(
      "@/lib/preferences/key-vault-state"
    );

    recordKeyVaultPublished("2026-08-19T09:00:00.000Z");
    forgetKeyVaultState();

    expect(readKeyVaultState()).toEqual({ publishedAt: undefined, drift: undefined });
  });
});
