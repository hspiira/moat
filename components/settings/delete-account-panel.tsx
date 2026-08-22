"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteAllUserData } from "@/lib/security/data-export";
import { FormCardShell } from "@/components/forms/form-card-shell";
import { InputField } from "@/components/forms/input-field";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const CONFIRM_PHRASE = "delete everything";

export function DeleteAccountPanel() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmation.toLowerCase() === CONFIRM_PHRASE;

  async function handleDelete() {
    if (!canDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteAllUserData();
      localStorage.removeItem("moat:pin_hash");
      localStorage.removeItem("moat:pin_salt");
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="grid content-start gap-3">
      <p className="text-sm leading-6 text-muted-foreground">
        Permanently remove all your financial records from this device. This cannot be undone.
        Export your data first if you want a copy.
      </p>

      <Button
        type="button"
        variant="outline"
        className="justify-self-start border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setConfirmation("");
          setError(null);
          setIsOpen(true);
        }}
      >
        Delete all data
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Delete all data</SheetTitle>
            <SheetDescription>This removes every record from this device.</SheetDescription>
          </SheetHeader>
          <FormCardShell
            embedded
            title="Delete all data"
            description="Every account, transaction, goal and category on this device is removed. This cannot be undone."
            footer={
              <Button
                type="submit"
                size="lg"
                variant="destructive"
                form="delete-account-form"
                disabled={!canDelete || isDeleting}
                className="w-full"
              >
                {isDeleting ? "Deleting..." : "Delete all data permanently"}
              </Button>
            }
          >
            <form
              id="delete-account-form"
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              <InputField
                id="delete-confirm"
                label={`Type "${CONFIRM_PHRASE}" to confirm`}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                error={error}
              />
            </form>
          </FormCardShell>
        </SheetContent>
      </Sheet>
    </div>
  );
}
