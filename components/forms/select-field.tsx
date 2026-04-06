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
};

export function SelectField({
  id,
  label,
  value,
  placeholder,
  options,
  onValueChange,
}: Props) {
  return (
    <div className="grid gap-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}>
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
    </div>
  );
}
