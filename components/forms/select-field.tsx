"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectFieldOption = {
  value: string;
  label: string;
};

type Props = {
  id?: string;
  label?: ReactNode;
  value: string;
  placeholder?: string;
  options: SelectFieldOption[];
  onValueChange: (value: string) => void;
  /** Field-level validation message. When set, the trigger is marked invalid. */
  error?: string | null;
};

export function SelectField({
  id,
  label,
  value,
  placeholder,
  options,
  onValueChange,
  error,
}: Props) {
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className="grid gap-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
