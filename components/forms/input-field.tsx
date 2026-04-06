"use client";

import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = Omit<ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
};

export function InputField({ id, label, hint, ...inputProps }: Props) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...inputProps} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
