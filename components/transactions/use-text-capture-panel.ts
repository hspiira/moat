"use client";

import { useEffect, useMemo, useState } from "react";

import { extractTextFromFiles } from "@/lib/capture/file-extractor";
import { parseCaptureText, type ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import { accountOptions, optionsFromRecord, transactionSourceLabels, transactionTypeLabels } from "@/lib/select-options";
import type { Account, Category, Transaction, TransactionSource } from "@/lib/types";

type CaptureSourceOption = TransactionSource;

export function useTextCapturePanel({
  accounts,
  categories,
  existingTransactions,
  initialInput,
}: {
  accounts: Account[];
  categories: Category[];
  existingTransactions: Transaction[];
  initialInput?: string;
}) {
  const [input, setInput] = useState("");
  const [source, setSource] = useState<CaptureSourceOption>("sms");
  const [accountId, setAccountId] = useState("");
  const [fallbackFxRate, setFallbackFxRate] = useState("");
  const [candidates, setCandidates] = useState<ParsedCaptureCandidate[]>([]);
  const [isExtractingFiles, setIsExtractingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialInput?.trim()) return;
    setInput((current) => (current.trim() ? current : initialInput));
  }, [initialInput]);

  const accountSelectOptions = useMemo(() => accountOptions(accounts), [accounts]);
  const typeOptions = useMemo(
    () => optionsFromRecord(transactionTypeLabels).filter((option) => option.value !== "transfer"),
    [],
  );
  const captureSourceOptions = useMemo(
    () => optionsFromRecord(transactionSourceLabels, ["sms", "notification", "manual"]),
    [],
  );

  function parseMessages() {
    const parsed = parseCaptureText({
      input,
      source,
      accountId: accountId || accounts[0]?.id || "",
      categories,
      existingTransactions,
      fallbackFxRate: Number(fallbackFxRate || 0) || undefined,
    });
    setCandidates(parsed);
  }

  async function appendFiles(files: File[]) {
    setIsExtractingFiles(true);
    setFileError(null);
    try {
      const extracted = await extractTextFromFiles(files);
      setInput((current) => [current.trim(), ...extracted].filter(Boolean).join("\n\n"));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Unable to extract text from file.");
    } finally {
      setIsExtractingFiles(false);
    }
  }

  function resetReview() {
    setCandidates([]);
  }

  function clearAll() {
    setInput("");
    setCandidates([]);
    setFileError(null);
  }

  function updateCandidate(candidateId: string, updater: (candidate: ParsedCaptureCandidate) => ParsedCaptureCandidate) {
    setCandidates((current) => current.map((entry) => (entry.id === candidateId ? updater(entry) : entry)));
  }

  return {
    input,
    setInput,
    source,
    setSource,
    accountId,
    setAccountId,
    fallbackFxRate,
    setFallbackFxRate,
    candidates,
    setCandidates,
    isExtractingFiles,
    fileError,
    accountSelectOptions,
    typeOptions,
    captureSourceOptions,
    parseMessages,
    appendFiles,
    resetReview,
    clearAll,
    updateCandidate,
  };
}
