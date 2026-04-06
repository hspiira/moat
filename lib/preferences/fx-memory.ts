"use client";

import type { SupportedCurrency } from "@/lib/types";

const FX_MEMORY_KEY = "moat.fx-memories";

export type FxMemory = {
  payeeKey: string;
  displayPayee: string;
  currency: SupportedCurrency;
  rateToUgx: number;
  updatedAt: string;
};

function readMemories(): FxMemory[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(FX_MEMORY_KEY);
    return raw ? (JSON.parse(raw) as FxMemory[]) : [];
  } catch {
    return [];
  }
}

function writeMemories(memories: FxMemory[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FX_MEMORY_KEY, JSON.stringify(memories));
}

export function normalizePayeeKey(payee: string) {
  return payee.trim().toLowerCase();
}

export function findFxMemory(payee: string, currency: SupportedCurrency) {
  const payeeKey = normalizePayeeKey(payee);
  if (!payeeKey || currency === "UGX") return null;

  return (
    readMemories().find((memory) => memory.payeeKey === payeeKey && memory.currency === currency) ??
    null
  );
}

export function saveFxMemory(entry: FxMemory) {
  const memories = readMemories();
  const next = memories.filter(
    (memory) => !(memory.payeeKey === entry.payeeKey && memory.currency === entry.currency),
  );
  next.unshift(entry);
  writeMemories(next.slice(0, 50));
}
