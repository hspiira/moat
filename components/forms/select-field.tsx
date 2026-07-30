"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectFieldOption = {
  value: string;
  label: string;
};

export type SelectFieldOptionGroup = {
  label: string;
  options: SelectFieldOption[];
};

type Props = {
  id?: string;
  label?: ReactNode;
  value: string;
  placeholder?: string;
  /** Ignored when `groups` is set. */
  options?: SelectFieldOption[];
  /** Headed sections, for lists long enough that a flat one is hard to scan. */
  groups?: SelectFieldOptionGroup[];
  onValueChange: (value: string) => void;
  /** Field-level validation message. When set, the trigger is marked invalid. */
  error?: string | null;
};

export function SelectField({
  id,
  label,
  value,
  placeholder,
  options = [],
  groups,
  onValueChange,
  error,
}: Props) {
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className="grid min-w-0 gap-2">
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
          {groups
            ? groups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
            : options.map((option) => (
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
