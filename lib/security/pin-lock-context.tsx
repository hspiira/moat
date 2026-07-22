"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  base64ToBytes,
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
import { decryptAllRecords, encryptAllRecordsWithDek } from "./data-migration";

const KEY_MATERIAL_KEY = "moat:key_material";
const LEGACY_PIN_HASH_KEY = "moat:pin_hash";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

type StoredKeyMaterial = {
  version: 2;
  pin: PinKeyMaterial;
  passkey?: PasskeyKeyMaterial;
};

/** Legacy (v1) PBKDF2 sentinel, read only to migrate off it. */
type LegacyPinRecord = {
  salt: string;
  payload: EncryptedPayload;
};

type PinLockState = { status: "no_pin" } | { status: "locked" } | { status: "unlocked" };

type PinLockContextValue = {
  lockState: PinLockState;
  /** Set (or change) the PIN. Returns false if the PIN is invalid or the operation fails. */
  setPin: (pin: string) => Promise<boolean>;
  /** Unlock with a PIN. Returns false if wrong or throttled. */
  unlock: (pin: string) => Promise<boolean>;
  /** Milliseconds until the next unlock attempt is allowed. 0 when not throttled. */
  getUnlockLockoutMs: () => number;
  /** Lock the session immediately. */
  lock: () => void;
  /** Remove the PIN and decrypt data back to plaintext. Requires the current PIN. */
  removePin: (currentPin: string) => Promise<boolean>;
  /** True if the app is PIN-protected (locked or unlocked). */
  hasPinLock: boolean;
  /** True if a passkey (biometric) unlock is enrolled. */
  hasPasskey: boolean;
  /** Enroll a passkey that unlocks the same data. Requires the app to be unlocked. */
  enablePasskey: () => Promise<{ ok: boolean; error?: string }>;
  /** Unlock with the enrolled passkey. Returns false if unavailable or cancelled. */
  unlockWithPasskey: () => Promise<boolean>;
  /** Remove the enrolled passkey (the PIN remains). */
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

/** Adopt the legacy PBKDF2 key bytes as the DEK — records stay readable, no re-encrypt. */
async function adoptLegacyKeyAsDek(pin: string, legacy: LegacyPinRecord): Promise<CryptoKey> {
  const bytes = await deriveLegacyKeyBytes(pin, base64ToUint8Array(legacy.payload.salt));
  return importDekBytes(bytes);
}

export function usePinLock(): PinLockContextValue {
  const ctx = useContext(PinLockContext);
  if (!ctx) {
    throw new Error("usePinLock must be used within PinLockProvider");
  }
  return ctx;
}

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [lockState, setLockState] = useState<PinLockState>(() => {
    if (typeof window === "undefined") {
      return { status: "no_pin" };
    }
    const hasMaterial =
      localStorage.getItem(KEY_MATERIAL_KEY) || localStorage.getItem(LEGACY_PIN_HASH_KEY);
    return hasMaterial ? { status: "locked" } : { status: "no_pin" };
  });
  const [hasPasskey, setHasPasskey] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(readKeyMaterial()?.passkey);
  });
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback((): void => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      setLockState((s) => (s.status === "unlocked" ? { status: "locked" } : s));
      setActiveRecordCryptoKey(null);
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (lockState.status !== "unlocked") {
      return;
    }

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

    function handleActivity() {
      resetInactivityTimer();
    }

    resetInactivityTimer();
    for (const event of events) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      for (const event of events) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [lockState.status, resetInactivityTimer]);

  const setPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!isValidPin(pin)) {
        return false;
      }

      const activeDek = getActiveRecordCryptoKey();

      // Changing the PIN while unlocked: just re-wrap the existing DEK,
      // preserving any enrolled passkey (it wraps the same DEK).
      if (activeDek) {
        writeStoredMaterial({
          version: 2,
          pin: await createPinKeyMaterial(pin, activeDek),
          passkey: readKeyMaterial()?.passkey,
        });
        localStorage.removeItem(LEGACY_PIN_HASH_KEY);
        setLockState({ status: "unlocked" });
        resetInactivityTimer();
        return true;
      }

      // Fresh enable: generate a DEK, encrypt any existing plaintext records,
      // then store the wrapped material.
      const dek = await generateDek();
      try {
        await encryptAllRecordsWithDek(dek); // activates the DEK on success
        writeStoredMaterial({ version: 2, pin: await createPinKeyMaterial(pin, dek) });
        localStorage.removeItem(LEGACY_PIN_HASH_KEY);
      } catch {
        setActiveRecordCryptoKey(null);
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
        } catch {
          dek = null;
        }
      } else if (legacy) {
        const valid = await verifyPin(legacy.payload, pin);
        if (valid) {
          // Migrate off PBKDF2: adopt the old key as the DEK and re-wrap with Argon2id.
          dek = await adoptLegacyKeyAsDek(pin, legacy);
          writeStoredMaterial({ version: 2, pin: await createPinKeyMaterial(pin, dek) });
          localStorage.removeItem(LEGACY_PIN_HASH_KEY);
        }
      }

      if (!dek) {
        writeAttemptState(localStorage, recordFailedAttempt(attemptState, Date.now()));
        return false;
      }

      writeAttemptState(localStorage, INITIAL_ATTEMPT_STATE);
      setActiveRecordCryptoKey(dek);
      setLockState({ status: "unlocked" });
      resetInactivityTimer();
      return true;
    },
    [resetInactivityTimer],
  );

  const lock = useCallback(() => {
    setLockState((s) => (s.status === "no_pin" ? s : { status: "locked" }));
    setActiveRecordCryptoKey(null);
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
  }, []);

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

    // Decrypt everything back to plaintext, then drop all key material.
    setActiveRecordCryptoKey(dek);
    await decryptAllRecords();
    localStorage.removeItem(KEY_MATERIAL_KEY);
    localStorage.removeItem(LEGACY_PIN_HASH_KEY);
    writeAttemptState(localStorage, INITIAL_ATTEMPT_STATE);
    setHasPasskey(false);
    setLockState({ status: "no_pin" });
    return true;
  }, []);

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
      setLockState({ status: "unlocked" });
      resetInactivityTimer();
      return true;
    } catch {
      return false;
    }
  }, [resetInactivityTimer]);

  const removePasskey = useCallback((): void => {
    const material = readKeyMaterial();
    if (!material) return;
    writeStoredMaterial({ version: material.version, pin: material.pin });
    setHasPasskey(false);
  }, []);

  const hasPinLock = lockState.status !== "no_pin";

  return (
    <PinLockContext.Provider
      value={{
        lockState,
        setPin,
        unlock,
        getUnlockLockoutMs,
        lock,
        removePin,
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
