"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteAllUserData } from "@/lib/security/data-export";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountPanel() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CONFIRM_PHRASE = "delete everything";
  const canDelete = confirmation.toLowerCase() === CONFIRM_PHRASE;

  async function handleDelete() {
    if (!canDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteAllUserData();
      // Clear any local storage keys used by the app
      localStorage.removeItem("moat:pin_hash");
      localStorage.removeItem("moat:pin_salt");
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed.");
      setIsDeleting(false);
    }
  }

  return (
    <Card className="border-destructive/20 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-destructive">Delete account and all data</CardTitle>
        <CardDescription>
          Permanently remove all your financial records from this device. This cannot be undone.
          Export your data first if you want a copy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="delete-confirm" className="text-xs text-muted-foreground">
            Type{" "}
            <span className="font-medium text-foreground">{CONFIRM_PHRASE}</span>{" "}
            to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            className="text-sm"
          />
        </div>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
        <Button
          variant="destructive"
          size="sm"
          disabled={!canDelete || isDeleting}
          onClick={() => void handleDelete()}
        >
          {isDeleting ? "Deleting..." : "Delete all data permanently"}
        </Button>
      </CardContent>
    </Card>
  );
}
