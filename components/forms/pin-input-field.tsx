"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
};

/**
 * A numeric-only, masked PIN input with the label/tracking treatment shared
 * by the backup panel's four PIN fields. Not used by the PIN-lock screen,
 * which has its own dedicated input.
 */
export function PinInputField({ id, label, value, onChange, placeholder, autoComplete }: Props) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={12}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="tracking-[0.3em]"
      />
    </div>
  );
}
