import { useState } from "react";

/**
 * Shared open/close state for a sheet-hosted create/edit form. Callers pass
 * the workspace's `cancelEdit` so opening for "add" starts from a clean form
 * and closing (via the sheet's own onOpenChange, or `close`) always resets
 * any in-progress edit.
 */
export function useFormSheet(cancelEdit: () => void) {
  const [isOpen, setIsOpen] = useState(false);

  function openForCreate() {
    cancelEdit();
    setIsOpen(true);
  }

  function openForEdit(beginEdit: () => void) {
    beginEdit();
    setIsOpen(true);
  }

  function onOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen);
    if (!nextOpen) {
      cancelEdit();
    }
  }

  function close() {
    onOpenChange(false);
  }

  return { isOpen, openForCreate, openForEdit, onOpenChange, close };
}
