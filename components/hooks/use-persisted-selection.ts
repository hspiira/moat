"use client";

import { useEffect, useState } from "react";

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function select(next: T) {
    setValue(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
    }
  }

  return [value, select] as const;
}
