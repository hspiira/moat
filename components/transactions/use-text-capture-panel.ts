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
    () => optionsFromRecord(transactionTypeLabels),
    [],
  );
  const captureSourceOptions = useMemo(
    () => optionsFromRecord(transactionSourceLabels, ["sms", "notification", "manual"]),
    [],
  );


  // Reading the text is cheap and pure, so it happens as you paste rather than
  // behind a button you have to go and find. Settling first keeps the list from
  // flickering while typing.
  useEffect(() => {
    if (!input.trim()) {
      setCandidates([]);
      return;
    }

    const timer = setTimeout(() => {
      setCandidates(
        parseCaptureText({
          input,
          source,
          accountId: accountId || accounts[0]?.id || "",
          categories,
          existingTransactions,
          fallbackFxRate: Number(fallbackFxRate || 0) || undefined,
        }),
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [input, source, accountId, fallbackFxRate, accounts, categories, existingTransactions]);

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
    appendFiles,
    resetReview,
    clearAll,
    updateCandidate,
  };
}
