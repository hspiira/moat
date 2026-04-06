"use client";

import { useMemo, useState } from "react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { accountOptions, categoryOptions, optionsFromRecord, transactionSourceLabels, transactionTypeLabels } from "@/lib/select-options";
import type { Account, Category, TransactionSource, TransactionType } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { parseCaptureText, type ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import { formatMoney } from "@/lib/currency";

type Props = {
  accounts: Account[];
  categories: Category[];
  existingTransactions: import("@/lib/types").Transaction[];
  isSubmitting: boolean;
  active: boolean;
  onSaveCaptured: (candidates: ParsedCaptureCandidate[]) => Promise<void>;
};

type CaptureSourceOption = TransactionSource;

const captureSourceOptions = optionsFromRecord(transactionSourceLabels, ["sms", "notification", "manual"]);

export function TextCapturePanel({
  accounts,
  categories,
  existingTransactions,
  isSubmitting,
  active,
  onSaveCaptured,
}: Props) {
  const [input, setInput] = useState("");
  const [source, setSource] = useState<CaptureSourceOption>("sms");
  const [accountId, setAccountId] = useState("");
  const [fallbackFxRate, setFallbackFxRate] = useState("");
  const [candidates, setCandidates] = useState<ParsedCaptureCandidate[]>([]);

  const accountSelectOptions = useMemo(() => accountOptions(accounts), [accounts]);
  const typeOptions = useMemo(
    () => optionsFromRecord(transactionTypeLabels).filter((option) => option.value !== "transfer"),
    [],
  );

  function handleParse() {
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

  async function handleSave() {
    await onSaveCaptured(candidates);
    setInput("");
    setCandidates([]);
  }

  return (
    <Card className={`gap-0 border-border/20 pt-0 shadow-none ${active ? "ring-1 ring-primary/30" : ""}`}>
      <AccentCardHeader
        tone="sage"
        title="Text capture"
        description="Paste raw transaction messages, review the extracted candidates, then save them to the books."
      />
      <CardContent className="grid gap-4 p-5">
        <div className="grid gap-3 md:grid-cols-[0.8fr_1fr_0.8fr]">
          <SelectField
            id="capture-source"
            label="Source"
            value={source}
            options={captureSourceOptions}
            onValueChange={(value) => setSource(value as CaptureSourceOption)}
          />
          <SelectField
            id="capture-account"
            label="Post to account"
            value={accountId || accounts[0]?.id || ""}
            options={accountSelectOptions}
            onValueChange={setAccountId}
          />
          <InputField
            id="capture-fx"
            label="Fallback FX to UGX"
            inputMode="decimal"
            value={fallbackFxRate}
            onChange={(event) => setFallbackFxRate(event.target.value)}
            hint="Used only when a parsed message is not in UGX and does not include an FX rate."
          />
        </div>

        <TextareaField
          id="capture-input"
          label="Pasted messages"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={"Example:\nReceived UGX 1,763,170 from Minet Uganda on 27-03-2026\n\nPaid USh 300,000 to School fees on 06-04-2026"}
          className="min-h-32"
        />

        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={!input.trim()} onClick={handleParse}>
            Parse messages
          </Button>
          {candidates.length > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setCandidates([])}>
              Clear review
            </Button>
          ) : null}
        </div>

        {candidates.length === 0 ? (
          <EmptyState className="py-6">
            Paste one or more messages, separated by blank lines, to build reviewable candidates.
          </EmptyState>
        ) : (
          <div className="grid gap-3">
            {candidates.map((candidate, index) => (
              <div key={candidate.id} className="grid gap-3 border border-border/20 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">Candidate {index + 1}</div>
                    <div className="text-xs text-muted-foreground">
                      Confidence {Math.round(candidate.confidence * 100)}%
                    </div>
                  </div>
                  <div className="text-sm text-foreground">
                    {formatMoney(candidate.originalAmount, candidate.currency)}
                    {candidate.currency !== "UGX" ? ` · ${formatMoney(candidate.normalizedAmount, "UGX")}` : ""}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <SelectField
                    id={`capture-type-${candidate.id}`}
                    label="Type"
                    value={candidate.type}
                    options={typeOptions}
                    onValueChange={(value) =>
                      setCandidates((current) =>
                        current.map((entry) =>
                          entry.id === candidate.id
                            ? {
                                ...entry,
                                type: value as Exclude<TransactionType, "transfer">,
                                categoryId:
                                  categories.find((category) =>
                                    value === "income"
                                      ? category.kind === "income"
                                      : value === "savings_contribution"
                                        ? category.kind === "savings"
                                        : category.kind === "expense",
                                  )?.id ?? entry.categoryId,
                              }
                            : entry,
                        ),
                      )
                    }
                  />
                  <SelectField
                    id={`capture-category-${candidate.id}`}
                    label="Category"
                    value={candidate.categoryId}
                    options={categoryOptions(categories)}
                    onValueChange={(value) =>
                      setCandidates((current) =>
                        current.map((entry) => (entry.id === candidate.id ? { ...entry, categoryId: value } : entry)),
                      )
                    }
                  />
                  <InputField
                    id={`capture-date-${candidate.id}`}
                    label="Date"
                    value={candidate.occurredOn}
                    onChange={(event) =>
                      setCandidates((current) =>
                        current.map((entry) => (entry.id === candidate.id ? { ...entry, occurredOn: event.target.value } : entry)),
                      )
                    }
                  />
                  <InputField
                    id={`capture-payee-${candidate.id}`}
                    label="Payee / source"
                    value={candidate.payee}
                    onChange={(event) =>
                      setCandidates((current) =>
                        current.map((entry) => (entry.id === candidate.id ? { ...entry, payee: event.target.value } : entry)),
                      )
                    }
                  />
                  <InputField
                    id={`capture-amount-${candidate.id}`}
                    label={`Amount (${candidate.currency})`}
                    inputMode="decimal"
                    value={String(candidate.originalAmount)}
                    onChange={(event) =>
                      setCandidates((current) =>
                        current.map((entry) =>
                          entry.id === candidate.id
                            ? { ...entry, originalAmount: Number(event.target.value) || 0 }
                            : entry,
                        ),
                      )
                    }
                  />
                  {candidate.currency !== "UGX" ? (
                    <InputField
                      id={`capture-fx-rate-${candidate.id}`}
                      label="FX rate to UGX"
                      inputMode="decimal"
                      value={String(candidate.fxRateToUgx ?? "")}
                      onChange={(event) =>
                        setCandidates((current) =>
                          current.map((entry) =>
                            entry.id === candidate.id
                              ? { ...entry, fxRateToUgx: Number(event.target.value) || undefined }
                              : entry,
                          ),
                        )
                      }
                    />
                  ) : null}
                </div>

                <TextareaField
                  id={`capture-note-${candidate.id}`}
                  label="Raw note"
                  value={candidate.note}
                  onChange={(event) =>
                    setCandidates((current) =>
                      current.map((entry) => (entry.id === candidate.id ? { ...entry, note: event.target.value } : entry)),
                    )
                  }
                  className="min-h-20"
                />

                {candidate.issues.length > 0 ? (
                  <div className="grid gap-1 text-xs text-destructive">
                    {candidate.issues.map((issue) => (
                      <div key={`${candidate.id}:${issue}`}>{issue}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={isSubmitting} onClick={() => void handleSave()}>
                Save reviewed candidates
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
