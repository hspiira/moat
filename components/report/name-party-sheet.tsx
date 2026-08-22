"use client";

import { useState } from "react";

import { FormCardShell } from "@/components/forms/form-card-shell";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import type { CounterpartyNature } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NATURE_OPTIONS: { value: CounterpartyNature; label: string }[] = [
  { value: "business", label: "A business" },
  { value: "person", label: "A person" },
];

export function NamePartySheet({
  suggestion,
  isOpen,
  isSubmitting,
  onOpenChange,
  onSave,
}: {
  suggestion: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, nature: CounterpartyNature) => void;
}) {
  // The parent remounts this per party, so the suggestion is the initial value
  // rather than something to sync in an effect.
  const [name, setName] = useState(suggestion);
  const [nature, setNature] = useState<CounterpartyNature>("business");

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="sr-only">
          <SheetTitle>Name this party</SheetTitle>
          <SheetDescription>Give the payee a name you recognise.</SheetDescription>
        </SheetHeader>
        <FormCardShell
          embedded
          title="Name this party"
          description="Every payment read under this name is filed against it. Give two spellings the same name and they become one party."
          footer={
            <Button
              type="submit"
              size="lg"
              form="name-party-form"
              disabled={isSubmitting || !name.trim()}
              className="w-full"
            >
              {isSubmitting ? "Saving..." : "Save name"}
            </Button>
          }
        >
          <form
            id="name-party-form"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSave(name, nature);
            }}
          >
            <InputField
              id="party-name"
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              hint="What you would call them, not what the message said."
            />
            <SelectField
              id="party-nature"
              label="What are they"
              value={nature}
              options={NATURE_OPTIONS}
              onValueChange={(value) => setNature(value as CounterpartyNature)}
            />
          </form>
        </FormCardShell>
      </SheetContent>
    </Sheet>
  );
}
