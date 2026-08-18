import { useState } from "react";

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
