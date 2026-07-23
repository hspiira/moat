"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
// Current on-disk index format. Records written before blind indexes (v1) are
// re-encrypted to v2 on first unlock; the marker keeps it a one-time pass.
const BLIND_INDEX_VERSION_KEY = "moat:blind_index_version";
const BLIND_INDEX_VERSION = "2";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
// How long the app may stay hidden (backgrounded, screen off, app switcher)
// before it locks on return. Deliberately much shorter than the inactivity
// window: leaving the app is a stronger "walked away" signal than idling in it.
const BACKGROUND_LOCK_MS = 60 * 1000;
// Locking in one tab locks every tab sharing the origin.
const LOCK_CHANNEL_NAME = "moat:lock";

/**
 * Migrate plaintext-metadata records to keyed blind indexes if not already
 * done. Idempotent and safe to retry: the DEK stays active, contents are
 * untouched, and the marker is only set once every record is re-blinded.
 */
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
    // Leave the marker unset so the next unlock retries; records stay readable.
    console.warn("Moat: blind-index migration deferred; will retry on next unlock.", error);
  }
}

type StoredKeyMaterial = {
  version: 2;
  pin: PinKeyMaterial;
  passkey?: PasskeyKeyMaterial;
  /**
   * Number of digits in the PIN, so the lock screen can auto-submit the moment
   * the last digit is entered (phone-lockscreen behaviour). Backfilled on the
   * next unlock for material saved before this field existed. Not sensitive:
   * the DEK is protected by Argon2id cost + throttling, which knowing the
   * length does not weaken in any practical way.
   */
  pinLength?: number;
};

/** Legacy (v1) PBKDF2 sentinel, read only to migrate off it. */
type LegacyPinRecord = {
  salt: string;
  payload: EncryptedPayload;
};

type PinLockState =
  | { status: "initializing" }
  | { status: "no_pin" }
  | { status: "locked" }
  // Correct PIN accepted; the DEK is active and the app can mount behind the
  // lock screen while it plays its unlock reveal. `completeUnlock` finishes it.
  | { status: "unlocking" }
  | { status: "unlocked" };

type PinLockContextValue = {
  lockState: PinLockState;
  /** Set (or change) the PIN. Returns false if the PIN is invalid or the operation fails. */
  setPin: (pin: string) => Promise<boolean>;
  /** Unlock with a PIN. Returns false if wrong or throttled. */
  unlock: (pin: string) => Promise<boolean>;
  /** Milliseconds until the next unlock attempt is allowed. 0 when not throttled. */
  getUnlockLockoutMs: () => number;
  /**
   * Attempts left before a wrong PIN triggers the first lockout. 0 once
   * lockouts have begun (each further failure re-locks immediately).
   */
  getAttemptsUntilLockout: () => number;
  /** Total duration of the lockout currently in effect, for countdown UI. 0 when none. */
  getCurrentLockoutTotalMs: () => number;
  /** Digits in the saved PIN, so the lock screen can auto-submit. Null if unknown. */
  getPinLength: () => number | null;
  /** Finish the unlock reveal: transition from `unlocking` to `unlocked`. */
  completeUnlock: () => void;
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
  // Start "initializing" so the server and the first client render match; the
  // real state (which depends on client-only localStorage) is resolved on mount.
  const [lockState, setLockState] = useState<PinLockState>({ status: "initializing" });
  const [hasPasskey, setHasPasskey] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Wall-clock timestamps: setTimeout is suspended while the device sleeps or
  // the tab is backgrounded, so elapsed real time must be checked on return.
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

  // Mirror locks across tabs sharing this origin.
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
    // Hydration-safe: resolve client-only lock state once after mount so the
    // server and first client render stay identical.
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

    // The timer only fires while the page is running; sleep and backgrounding
    // suspend it. On any return to the foreground, compare wall-clock time
    // against both the background threshold and the inactivity window.
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

      // Changing the PIN while unlocked: just re-wrap the existing DEK,
      // preserving any enrolled passkey (it wraps the same DEK).
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

      // Fresh enable: generate a DEK, encrypt any existing plaintext records,
      // then store the wrapped material.
      const dek = await generateDek();
      try {
        await encryptAllRecordsWithDek(dek); // activates the DEK on success
        writeStoredMaterial({ version: 2, pin: await createPinKeyMaterial(pin, dek), pinLength: pin.length });
        localStorage.removeItem(LEGACY_PIN_HASH_KEY);
        // Records are written v2 (blinded) from the start, so mark it done.
        localStorage.setItem(BLIND_INDEX_VERSION_KEY, BLIND_INDEX_VERSION);
      } catch {
        // encryptAllRecordsWithDek owns key state on failure: it either rolled
        // the data back to plaintext (key cleared) or kept the DEK active
        // because some records are already encrypted with it. Don't force-null.
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
          // Backfill the PIN length for material saved before auto-submit existed.
          if (material.pinLength == null) {
            writeStoredMaterial({ ...material, pinLength: pin.length });
          }
        } catch {
          dek = null;
        }
      } else if (legacy) {
        const valid = await verifyPin(legacy.payload, pin);
        if (valid) {
          // Migrate off PBKDF2: adopt the old key as the DEK and re-wrap with Argon2id.
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
      // Hand off to the lock screen's reveal; it calls completeUnlock when done.
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

    // Decrypt everything back to plaintext, then drop all key material.
    setActiveRecordCryptoKey(dek);
    await decryptAllRecords();
    localStorage.removeItem(KEY_MATERIAL_KEY);
    localStorage.removeItem(LEGACY_PIN_HASH_KEY);
    localStorage.removeItem(BLIND_INDEX_VERSION_KEY);
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
