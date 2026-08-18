"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { InputField } from "@/components/forms/input-field";
import { formatAmountForInput, parseAmountInput } from "@/lib/parse-amount";

type Props = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
};

export function AmountField({ id, label, hint, error, value, onValueChange }: Props) {
  const [text, setText] = useState(() => formatAmountForInput(value));
  const [syncedValue, setSyncedValue] = useState<number | null>(value ?? null);

  const incoming = value ?? null;
  if (incoming !== syncedValue) {
    setSyncedValue(incoming);
    if (incoming !== parseAmountInput(text)) {
      setText(formatAmountForInput(incoming));
    }
  }

  return (
    <InputField
      id={id}
      label={label}
      hint={hint}
      error={error}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        const parsed = parseAmountInput(raw);
        setSyncedValue(parsed);
        onValueChange(parsed);
      }}
      onBlur={() => setText(formatAmountForInput(parseAmountInput(text)))}
    />
  );
}
