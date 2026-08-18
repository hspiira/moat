export const MIN_PIN_LENGTH = 6;

export const PIN_REQUIREMENT_MESSAGE = `PIN must be at least ${MIN_PIN_LENGTH} digits.`;

export function isValidPin(pin: string): boolean {
  return pin.length >= MIN_PIN_LENGTH && /^\d+$/.test(pin);
}

export type PinAttemptState = {
  failedCount: number;
  lastFailedAt: number;
};

const FREE_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60 * 1000;

export const INITIAL_ATTEMPT_STATE: PinAttemptState = {
  failedCount: 0,
  lastFailedAt: 0,
};

export function getAttemptsUntilLockout(state: PinAttemptState): number {
  return Math.max(0, FREE_ATTEMPTS - state.failedCount);
}

export function getLockoutDurationMs(failedCount: number): number {
  if (failedCount < FREE_ATTEMPTS) {
    return 0;
  }

  const escalation = 2 ** (failedCount - FREE_ATTEMPTS);
  return Math.min(BASE_LOCKOUT_MS * escalation, MAX_LOCKOUT_MS);
}

export function getRemainingLockoutMs(state: PinAttemptState, now: number): number {
  const lockoutMs = getLockoutDurationMs(state.failedCount);
  if (lockoutMs === 0) {
    return 0;
  }

  return Math.max(0, state.lastFailedAt + lockoutMs - now);
}

export function recordFailedAttempt(state: PinAttemptState, now: number): PinAttemptState {
  return {
    failedCount: state.failedCount + 1,
    lastFailedAt: now,
  };
}

const ATTEMPT_STATE_KEY = "moat:pin_attempts";

export function readAttemptState(storage: Pick<Storage, "getItem">): PinAttemptState {
  const raw = storage.getItem(ATTEMPT_STATE_KEY);
  if (!raw) {
    return INITIAL_ATTEMPT_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PinAttemptState>;
    if (typeof parsed.failedCount !== "number" || typeof parsed.lastFailedAt !== "number") {
      return INITIAL_ATTEMPT_STATE;
    }
    return { failedCount: parsed.failedCount, lastFailedAt: parsed.lastFailedAt };
  } catch {
    return INITIAL_ATTEMPT_STATE;
  }
}

export function writeAttemptState(
  storage: Pick<Storage, "setItem" | "removeItem">,
  state: PinAttemptState,
): void {
  if (state.failedCount === 0) {
    storage.removeItem(ATTEMPT_STATE_KEY);
    return;
  }

  storage.setItem(ATTEMPT_STATE_KEY, JSON.stringify(state));
}
