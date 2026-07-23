"use client";

import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Field-level validation message. When set, the input is marked invalid. */
  error?: string | null;
};

export function InputField({ id, label, hint, error, className, ...inputProps }: Props) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={inputProps.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(error && "border-destructive focus-visible:border-destructive", className)}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
