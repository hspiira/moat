"use client";

import { useCallback, useState } from "react";

/**
 * Guards a delete action behind a confirmation modal. Call `request(item, label)`
 * from a trash button, spread the returned state into a <ConfirmDialog />, and
 * the wrapped `onDelete` only runs once the user confirms.
 */
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
    /** The label of the item pending deletion (for the dialog description). */
    label: pending?.label ?? "",
    dialogProps: {
      open: pending !== null,
      onOpenChange,
      busy,
      onConfirm: confirm,
    },
  };
}
