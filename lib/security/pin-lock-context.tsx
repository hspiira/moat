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
  deriveSessionKey,
  encryptWithPin,
  verifyPin,
  type EncryptedPayload,
} from "./pin-crypto";
import { setActiveRecordCryptoKey } from "./record-crypto";

const PIN_HASH_KEY = "moat:pin_hash";
const PIN_SALT_KEY = "moat:pin_salt";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Stored in localStorage: a small encrypted sentinel used to verify the PIN. */
type PinRecord = {
  salt: string;
  payload: EncryptedPayload;
};

type PinLockState =
  | { status: "no_pin" }
  | { status: "locked" }
  | { status: "unlocked" };

type PinLockContextValue = {
  lockState: PinLockState;
  /** Set a new PIN (replaces any existing one). Returns false if PIN is too short. */
  setPin: (pin: string) => Promise<boolean>;
  /** Unlock with a PIN. Returns false if PIN is wrong. */
  unlock: (pin: string) => Promise<boolean>;
  /** Lock the session immediately. */
  lock: () => void;
  /** Remove PIN lock entirely. Requires current PIN to confirm. */
  removePin: (currentPin: string) => Promise<boolean>;
  /** True if the app is PIN-protected (regardless of locked/unlocked state). */
  hasPinLock: boolean;
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

    return localStorage.getItem(PIN_HASH_KEY) ? { status: "locked" } : { status: "no_pin" };
  });
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback((): void => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      setLockState((s) => (s.status === "unlocked" ? { status: "locked" } : s));
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  // Track user activity to reset inactivity timer
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

  const setPin = useCallback(async (pin: string): Promise<boolean> => {
    if (pin.length < 4) {
      return false;
    }

    // Encrypt a known sentinel with the PIN so we can verify later
    const sentinel = { moat: true };
    const payload = await encryptWithPin(sentinel, pin);

    const record: PinRecord = {
      salt: payload.salt,
      payload,
    };

    localStorage.setItem(PIN_HASH_KEY, JSON.stringify(record));
    setActiveRecordCryptoKey(await deriveSessionKey(pin, base64ToUint8Array(payload.salt)));
    setLockState({ status: "unlocked" });
    resetInactivityTimer();
    return true;
  }, [resetInactivityTimer]);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const raw = localStorage.getItem(PIN_HASH_KEY);
    if (!raw) {
      return false;
    }

    const record = JSON.parse(raw) as PinRecord;
    const valid = await verifyPin(record.payload, pin);

    if (valid) {
      setActiveRecordCryptoKey(
        await deriveSessionKey(pin, base64ToUint8Array(record.payload.salt)),
      );
      setLockState({ status: "unlocked" });
      resetInactivityTimer();
    }

    return valid;
  }, [resetInactivityTimer]);

  const lock = useCallback(() => {
    setLockState((s) => (s.status === "no_pin" ? s : { status: "locked" }));
    setActiveRecordCryptoKey(null);
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
  }, []);

  const removePin = useCallback(async (currentPin: string): Promise<boolean> => {
    const raw = localStorage.getItem(PIN_HASH_KEY);
    if (!raw) {
      return false;
    }

    const record = JSON.parse(raw) as PinRecord;
    const valid = await verifyPin(record.payload, currentPin);

    if (valid) {
      localStorage.removeItem(PIN_HASH_KEY);
      localStorage.removeItem(PIN_SALT_KEY);
      setActiveRecordCryptoKey(null);
      setLockState({ status: "no_pin" });
    }

    return valid;
  }, []);

  const hasPinLock = lockState.status !== "no_pin";

  return (
    <PinLockContext.Provider
      value={{ lockState, setPin, unlock, lock, removePin, hasPinLock }}
    >
      {children}
    </PinLockContext.Provider>
  );
}
