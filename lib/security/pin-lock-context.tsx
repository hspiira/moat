"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { markKeyVaultDrift } from "@/lib/preferences/key-vault-state";
import { base64ToBytes } from "@/lib/security/codec";
import {
  createPasskeyKeyMaterial,
  createPinKeyMaterial,
  generateDek,
  importDekBytes,
  unwrapDekWithPin,
  unwrapDekWithPrf,
  type PasskeyKeyMaterial,
  type PinKeyMaterial,
} from "./key-hierarchy";
import { getPasskeyPrfOutput, registerPasskey } from "./passkey";
import { deriveLegacyKeyBytes, verifyPin, type EncryptedPayload } from "./pin-crypto";
import {
  INITIAL_ATTEMPT_STATE,
  getAttemptsUntilLockout as getPolicyAttemptsUntilLockout,
  getLockoutDurationMs,
  getRemainingLockoutMs,
  isValidPin,
  readAttemptState,
  recordFailedAttempt,
  writeAttemptState,
} from "./pin-policy";
import {
  getActiveRecordCryptoKey,
  setActiveRecordCryptoKey,
} from "./record-crypto";
import { decryptAllRecords, encryptAllRecordsWithDek, reblindAllRecords } from "./data-migration";

const KEY_MATERIAL_KEY = "moat:key_material";
const LEGACY_PIN_HASH_KEY = "moat:pin_hash";
const BLIND_INDEX_VERSION_KEY = "moat:blind_index_version";
const BLIND_INDEX_VERSION = "2";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_LOCK_MS = 60 * 1000;
const LOCK_CHANNEL_NAME = "moat:lock";

async function migrateBlindIndexesIfNeeded(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  if (localStorage.getItem(BLIND_INDEX_VERSION_KEY) === BLIND_INDEX_VERSION) {
    return;
  }
  try {
    await reblindAllRecords();
    localStorage.setItem(BLIND_INDEX_VERSION_KEY, BLIND_INDEX_VERSION);
  } catch (error) {
    console.warn("Moat: blind-index migration deferred; will retry on next unlock.", error);
  }
}

type StoredKeyMaterial = {
  version: 2;
  pin: PinKeyMaterial;
  passkey?: PasskeyKeyMaterial;
  pinLength?: number;
};

type LegacyPinRecord = {
  salt: string;
  payload: EncryptedPayload;
};

type PinLockState =
  | { status: "initializing" }
  | { status: "no_pin" }
  | { status: "locked" }
  | { status: "unlocking" }
  | { status: "unlocked" };

type PinLockContextValue = {
  lockState: PinLockState;
  setPin: (pin: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  getUnlockLockoutMs: () => number;
  getAttemptsUntilLockout: () => number;
  getCurrentLockoutTotalMs: () => number;
  getPinLength: () => number | null;
  completeUnlock: () => void;
  lock: () => void;
  removePin: (currentPin: string) => Promise<boolean>;
  adoptDeviceKey: (params: {
    dek: CryptoKey;
    pin: string;
    passkey?: PasskeyKeyMaterial | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  hasPinLock: boolean;
  hasPasskey: boolean;
  enablePasskey: () => Promise<{ ok: boolean; error?: string }>;
  unlockWithPasskey: () => Promise<boolean>;
  removePasskey: () => void;
};

const PinLockContext = createContext<PinLockContextValue | null>(null);

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function readKeyMaterial(): StoredKeyMaterial | null {
  const raw = localStorage.getItem(KEY_MATERIAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredKeyMaterial;
    return parsed.version === 2 && parsed.pin ? parsed : null;
  } catch {
    return null;
  }
}

function readLegacyRecord(): LegacyPinRecord | null {
  const raw = localStorage.getItem(LEGACY_PIN_HASH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LegacyPinRecord;
  } catch {
    return null;
  }
}

function writeStoredMaterial(material: StoredKeyMaterial): void {
  localStorage.setItem(KEY_MATERIAL_KEY, JSON.stringify(material));
}

async function adoptLegacyKeyAsDek(pin: string, legacy: LegacyPinRecord): Promise<CryptoKey> {
  const bytes = await deriveLegacyKeyBytes(pin, base64ToUint8Array(legacy.payload.salt));
  return importDekBytes(bytes);
}

// The key vault needs this device's passkey wrap so it can travel to Drive,
// and the vault lives outside the provider's tree.
export function readStoredPasskeyMaterial(): PasskeyKeyMaterial | null {
  if (typeof window === "undefined") {
    return null;
  }
  return readKeyMaterial()?.passkey ?? null;
}

export function usePinLock(): PinLockContextValue {
  const ctx = useContext(PinLockContext);
  if (!ctx) {
    throw new Error("usePinLock must be used within PinLockProvider");
  }
  return ctx;
}

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [lockState, setLockState] = useState<PinLockState>({ status: "initializing" });
  const [hasPasskey, setHasPasskey] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityAt = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const lockChannel = useRef<BroadcastChannel | null>(null);

  const applyLock = useCallback((options?: { broadcast?: boolean }) => {
    setLockState((s) => (s.status === "no_pin" || s.status === "initializing" ? s : { status: "locked" }));
    setActiveRecordCryptoKey(null);
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (options?.broadcast !== false) {
      lockChannel.current?.postMessage({ type: "lock" });
    }
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(LOCK_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "lock") {
        applyLock({ broadcast: false });
      }
    };
    lockChannel.current = channel;
    return () => {
      lockChannel.current = null;
      channel.close();
    };
  }, [applyLock]);

  useEffect(() => {
    const hasMaterial =
      localStorage.getItem(KEY_MATERIAL_KEY) || localStorage.getItem(LEGACY_PIN_HASH_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockState(hasMaterial ? { status: "locked" } : { status: "no_pin" });
    setHasPasskey(Boolean(readKeyMaterial()?.passkey));
  }, []);

  const resetInactivityTimer = useCallback((): void => {
    lastActivityAt.current = Date.now();
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => applyLock(), INACTIVITY_TIMEOUT_MS);
  }, [applyLock]);

  useEffect(() => {
    if (lockState.status !== "unlocked") {
      return;
    }

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

    function handleActivity() {
      resetInactivityTimer();
    }

    function handleReturnToForeground() {
      const now = Date.now();
      const hiddenFor = hiddenAt.current == null ? 0 : now - hiddenAt.current;
      hiddenAt.current = null;
      if (
        hiddenFor > BACKGROUND_LOCK_MS ||
        now - lastActivityAt.current > INACTIVITY_TIMEOUT_MS
      ) {
        applyLock();
        return;
      }
      resetInactivityTimer();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else {
        handleReturnToForeground();
      }
    }

    resetInactivityTimer();
    for (const event of events) {
      window.addEventListener(event, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handleReturnToForeground);
    window.addEventListener("focus", handleReturnToForeground);

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      for (const event of events) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handleReturnToForeground);
      window.removeEventListener("focus", handleReturnToForeground);
    };
  }, [lockState.status, resetInactivityTimer, applyLock]);

  const setPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!isValidPin(pin)) {
        return false;
      }

      const activeDek = getActiveRecordCryptoKey();

      if (activeDek) {
        writeStoredMaterial({
          version: 2,
          pin: await createPinKeyMaterial(pin, activeDek),
          passkey: readKeyMaterial()?.passkey,
          pinLength: pin.length,
        });
        localStorage.removeItem(LEGACY_PIN_HASH_KEY);
        setLockState({ status: "unlocked" });
        resetInactivityTimer();
        return true;
      }

      const dek = await generateDek();
      try {
        await encryptAllRecordsWithDek(dek); // activates the DEK on success
        writeStoredMaterial({ version: 2, pin: await createPinKeyMaterial(pin, dek), pinLength: pin.length });
        localStorage.removeItem(LEGACY_PIN_HASH_KEY);
        localStorage.setItem(BLIND_INDEX_VERSION_KEY, BLIND_INDEX_VERSION);
      } catch {
        return false;
      }
      setLockState({ status: "unlocked" });
      resetInactivityTimer();
      return true;
    },
    [resetInactivityTimer],
  );

  const getUnlockLockoutMs = useCallback((): number => {
    if (typeof window === "undefined") {
      return 0;
    }
    return getRemainingLockoutMs(readAttemptState(localStorage), Date.now());
  }, []);

  const getAttemptsUntilLockout = useCallback((): number => {
    if (typeof window === "undefined") {
      return Number.POSITIVE_INFINITY;
    }
    return getPolicyAttemptsUntilLockout(readAttemptState(localStorage));
  }, []);

  const getCurrentLockoutTotalMs = useCallback((): number => {
    if (typeof window === "undefined") {
      return 0;
    }
    return getLockoutDurationMs(readAttemptState(localStorage).failedCount);
  }, []);

  const getPinLength = useCallback((): number | null => {
    if (typeof window === "undefined") {
      return null;
    }
    return readKeyMaterial()?.pinLength ?? null;
  }, []);

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      const material = readKeyMaterial();
      const legacy = material ? null : readLegacyRecord();
      if (!material && !legacy) {
        return false;
      }

      const attemptState = readAttemptState(localStorage);
      if (getRemainingLockoutMs(attemptState, Date.now()) > 0) {
        return false;
      }

      let dek: CryptoKey | null = null;

      if (material) {
        try {
          dek = await unwrapDekWithPin(pin, material.pin);
          if (material.pinLength == null) {
            writeStoredMaterial({ ...material, pinLength: pin.length });
          }
        } catch {
          dek = null;
        }
      } else if (legacy) {
        const valid = await verifyPin(legacy.payload, pin);
        if (valid) {
          dek = await adoptLegacyKeyAsDek(pin, legacy);
          writeStoredMaterial({
            version: 2,
            pin: await createPinKeyMaterial(pin, dek),
            pinLength: pin.length,
          });
          localStorage.removeItem(LEGACY_PIN_HASH_KEY);
        }
      }

      if (!dek) {
        writeAttemptState(localStorage, recordFailedAttempt(attemptState, Date.now()));
        return false;
      }

      writeAttemptState(localStorage, INITIAL_ATTEMPT_STATE);
      setActiveRecordCryptoKey(dek);
      await migrateBlindIndexesIfNeeded();
      setLockState({ status: "unlocking" });
      return true;
    },
    [],
  );

  const completeUnlock = useCallback(() => {
    setLockState((s) => (s.status === "unlocking" ? { status: "unlocked" } : s));
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const lock = useCallback(() => {
    applyLock();
  }, [applyLock]);

  const removePin = useCallback(async (currentPin: string): Promise<boolean> => {
    const material = readKeyMaterial();
    const legacy = material ? null : readLegacyRecord();

    let dek: CryptoKey | null = null;
    if (material) {
      try {
        dek = await unwrapDekWithPin(currentPin, material.pin);
      } catch {
        return false;
      }
    } else if (legacy) {
      if (!(await verifyPin(legacy.payload, currentPin))) {
        return false;
      }
      dek = await adoptLegacyKeyAsDek(currentPin, legacy);
    } else {
      return false;
    }

    setActiveRecordCryptoKey(dek);
    await decryptAllRecords();
    localStorage.removeItem(KEY_MATERIAL_KEY);
    localStorage.removeItem(LEGACY_PIN_HASH_KEY);
    localStorage.removeItem(BLIND_INDEX_VERSION_KEY);
    writeAttemptState(localStorage, INITIAL_ATTEMPT_STATE);
    setHasPasskey(false);
    setLockState({ status: "no_pin" });
    markKeyVaultDrift("key-discarded");
    return true;
  }, []);

  // Joining a ledger that already exists: the records here are sealed under this
  // device's own key, so they are brought back to plaintext and re-sealed under
  // the adopted one. Both halves roll back on their own, so a failure leaves
  // readable records rather than a half-converted store.
  const adoptDeviceKey = useCallback(
    async (params: {
      dek: CryptoKey;
      pin: string;
      passkey?: PasskeyKeyMaterial | null;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (!isValidPin(params.pin)) {
        return { ok: false, error: "Choose a PIN for this device first." };
      }

      const material = readKeyMaterial();
      const legacy = material ? null : readLegacyRecord();

      if (material || legacy) {
        if (!getActiveRecordCryptoKey()) {
          return {
            ok: false,
            error: "Unlock Moat with this device's PIN first, then adopt the recovery key.",
          };
        }

        try {
          await decryptAllRecords();
        } catch {
          return { ok: false, error: "This device's records could not be re-keyed." };
        }
      }

      try {
        await encryptAllRecordsWithDek(params.dek); // activates the adopted key on success
      } catch {
        return { ok: false, error: "This device's records could not be re-keyed." };
      }

      writeStoredMaterial({
        version: 2,
        pin: await createPinKeyMaterial(params.pin, params.dek),
        passkey: params.passkey ?? undefined,
        pinLength: params.pin.length,
      });
      localStorage.removeItem(LEGACY_PIN_HASH_KEY);
      localStorage.setItem(BLIND_INDEX_VERSION_KEY, BLIND_INDEX_VERSION);
      writeAttemptState(localStorage, INITIAL_ATTEMPT_STATE);
      setHasPasskey(Boolean(params.passkey));
      setLockState({ status: "unlocked" });
      resetInactivityTimer();

      return { ok: true };
    },
    [resetInactivityTimer],
  );

  const enablePasskey = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const material = readKeyMaterial();
    const dek = getActiveRecordCryptoKey();
    if (!material || !dek) {
      return { ok: false, error: "Unlock Moat first, then set up biometric unlock." };
    }
    try {
      const enrollment = await registerPasskey({ userId: "moat-user", userName: "Moat" });
      const passkey = await createPasskeyKeyMaterial(
        dek,
        enrollment.credentialId,
        enrollment.prfSalt,
        enrollment.prfOutput,
      );
      writeStoredMaterial({ ...material, passkey });
      setHasPasskey(true);
      markKeyVaultDrift("passkey-added");
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not set up biometric unlock.",
      };
    }
  }, []);

  const unlockWithPasskey = useCallback(async (): Promise<boolean> => {
    const material = readKeyMaterial();
    if (!material?.passkey) return false;

    const attemptState = readAttemptState(localStorage);
    if (getRemainingLockoutMs(attemptState, Date.now()) > 0) {
      return false;
    }

    try {
      const prfOutput = await getPasskeyPrfOutput(
        material.passkey.credentialId,
        base64ToBytes(material.passkey.prfSalt),
      );
      const dek = await unwrapDekWithPrf(material.passkey, prfOutput);
      writeAttemptState(localStorage, INITIAL_ATTEMPT_STATE);
      setActiveRecordCryptoKey(dek);
      await migrateBlindIndexesIfNeeded();
      setLockState({ status: "unlocking" });
      return true;
    } catch {
      return false;
    }
  }, []);

  const removePasskey = useCallback((): void => {
    const material = readKeyMaterial();
    if (!material) return;
    writeStoredMaterial({ version: material.version, pin: material.pin, pinLength: material.pinLength });
    setHasPasskey(false);
    markKeyVaultDrift("passkey-removed");
  }, []);

  const hasPinLock =
    lockState.status === "locked" ||
    lockState.status === "unlocking" ||
    lockState.status === "unlocked";

  return (
    <PinLockContext.Provider
      value={{
        lockState,
        setPin,
        unlock,
        getUnlockLockoutMs,
        getAttemptsUntilLockout,
        getCurrentLockoutTotalMs,
        getPinLength,
        completeUnlock,
        lock,
        removePin,
        adoptDeviceKey,
        hasPinLock,
        hasPasskey,
        enablePasskey,
        unlockWithPasskey,
        removePasskey,
      }}
    >
      {children}
    </PinLockContext.Provider>
  );
}
