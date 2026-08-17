"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { getRememberedFxDefault, normalizePayeeKey } from "@/lib/preferences/fx-memory";
import { categoryMatchesType } from "@/lib/domain/transaction-classification";
import { todayIso } from "@/lib/today";
import type { Category } from "@/lib/types";

import { readCaptureParams } from "./capture-params";
import type { TransactionFormState } from "./transaction-form";

type SetForm = (update: (current: TransactionFormState) => TransactionFormState) => void;

export function useTransactionFormSync({
  form,
  setForm,
  categories,
  editingTransactionId,
}: {
  form: TransactionFormState;
  setForm: SetForm;
  categories: Category[];
  editingTransactionId: string | null;
}) {
  const searchParams = useSearchParams();
  const capture = useMemo(
    () => readCaptureParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const { hasPrefill, prefill } = capture;
  useEffect(() => {
    if (!hasPrefill) return;
    setForm((current) => {
      const type = (prefill.type as TransactionFormState["type"]) || current.type;
      return {
        ...current,
        type,
        accountId: prefill.accountId || current.accountId,
        amount: prefill.amount || current.amount,
        payee: prefill.payee || current.payee,
        categoryId:
          categories.find((category) => categoryMatchesType(category, type))?.id ??
          current.categoryId,
      };
    });
  }, [categories, hasPrefill, prefill, setForm]);

  useDateRollover({ setForm, editingTransactionId });

  const rememberedFx = useMemo(() => {
    const payee = form.payee.trim();
    if (form.currency === "UGX" || !payee) return null;
    return getRememberedFxDefault(payee, form.currency);
  }, [form.currency, form.payee]);

  useEffect(() => {
    if (!rememberedFx) return;
    setForm((current) => {
      if (current.fxRateToUgx) return current;
      if (current.currency !== rememberedFx.currency) return current;
      if (normalizePayeeKey(current.payee) !== rememberedFx.payeeKey) return current;
      return { ...current, fxRateToUgx: String(rememberedFx.rateToUgx) };
    });
  }, [rememberedFx, setForm]);

  return {
    captureIntent: capture.intent,
    sharedCaptureInput: capture.sharedInput,
    rememberedFxHint: rememberedFx?.hint ?? null,
  };
}

// Only a date the app stamped itself moves; a date the user picked is left alone.
function useDateRollover({
  setForm,
  editingTransactionId,
}: {
  setForm: SetForm;
  editingTransactionId: string | null;
}) {
  const stamped = useRef(todayIso());

  useEffect(() => {
    const refresh = () => {
      const today = todayIso();
      if (stamped.current === today) return;
      const previous = stamped.current;
      stamped.current = today;
      if (editingTransactionId) return;
      setForm((current) =>
        current.occurredOn === previous ? { ...current, occurredOn: today } : current,
      );
    };

    refresh();
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [editingTransactionId, setForm]);
}
