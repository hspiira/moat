"use client";

import { useCallback, useState } from "react";

export function useConfirmDelete<T>(onDelete: (item: T) => void | Promise<void>) {
  const [pending, setPending] = useState<{ item: T; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useCallback((item: T, label: string) => {
    setPending({ item, label });
  }, []);

  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setPending(null);
  }, []);

  const confirm = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await onDelete(pending.item);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }, [onDelete, pending]);

  return {
    request,
    label: pending?.label ?? "",
    dialogProps: {
      open: pending !== null,
      onOpenChange,
      busy,
      onConfirm: confirm,
    },
  };
}
