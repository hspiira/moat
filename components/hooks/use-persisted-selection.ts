"use client";

import { useEffect, useState } from "react";

/**
 * A selection that survives a refresh — period filters, report windows,
 * capture method. UI preference only: nothing financial belongs here.
 *
 * The stored value is applied in an effect rather than the initializer so the
 * first client render matches the server-rendered HTML; these controls sit
 * behind loading skeletons, so the swap is not visible.
 */
export function usePersistedSelection<T extends string | number>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return;
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) setValue(parsed);
    } catch {
      // A corrupt entry is a preference, not data; the default stands in.
    }
    // Restore once per key: isValid is a type guard, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function select(next: T) {
    setValue(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage full or blocked — the selection still applies for the session.
    }
  }

  return [value, select] as const;
}
