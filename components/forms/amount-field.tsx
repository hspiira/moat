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
  /** Null means the field was cleared. */
  onValueChange: (value: number | null) => void;
};

/**
 * Money input that lets people type the way they read: "1,790,590".
 *
 * It keeps the raw text locally so separators survive keystroke-by-keystroke —
 * deriving the displayed string from the parsed number instead would delete the
 * comma the moment it was typed. The parsed value flows out on every change, and
 * the text is regrouped on blur so the field settles into a readable figure.
 */
export function AmountField({ id, label, hint, error, value, onValueChange }: Props) {
  const [text, setText] = useState(() => formatAmountForInput(value));
  const [syncedValue, setSyncedValue] = useState<number | null>(value ?? null);

  // Adjust state during render rather than in an effect (the pattern this
  // codebase already uses for "re-sync when a prop changes"). An incoming value
  // that our own text does not already parse to came from outside — a rule, the
  // "Add as fee" shortcut, a different item — so adopt it. Ordinary typing
  // parses to the same number and is left alone.
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
