"use client";

import type { ComponentProps, ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = Omit<ComponentProps<typeof Textarea>, "id"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
};

export function TextareaField({ id, label, hint, ...textareaProps }: Props) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={textareaProps.name ?? id} {...textareaProps} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
