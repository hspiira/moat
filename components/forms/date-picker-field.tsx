"use client";

import type { ReactNode } from "react";

import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: ReactNode;
  value: string;
  hint?: ReactNode;
  onChange: (value: string) => void;
};

export function DatePickerField({ id, label, value, hint, onChange }: Props) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <DatePicker id={id} value={value} onChange={onChange} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
