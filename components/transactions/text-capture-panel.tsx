"use client";

import { useMemo, useState } from "react";

import { AccentCardHeader } from "@/components/accent-card-header";
import { AmountField } from "@/components/forms/amount-field";
import { InputField } from "@/components/forms/input-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { categoryOptions } from "@/lib/select-options";
import type { Account, Category, TransactionSource, TransactionType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import { formatMoney } from "@/lib/currency";
import { pendingReviewGap } from "@/lib/domain/balance-gap";
import { coerceCategoryForType } from "@/lib/domain/transaction-classification";
import { useTextCapturePanel } from "./use-text-capture-panel";

type Props = {
  accounts: Account[];
  categories: Category[];
  existingTransactions: import("@/lib/types").Transaction[];
  isSubmitting: boolean;
  initialInput?: string;
  onSaveCaptured: (candidates: ParsedCaptureCandidate[]) => Promise<void>;
  /** When true, render just the content for use inside a sheet (no card chrome). */
  embedded?: boolean;
};

/**
 * Some banks — Centenary in particular — charge a fee they never state in the
 * alert, but they do state the resulting balance. The difference between that
 * balance and what the recorded ledger predicts is the fee, so it can be
 * recovered rather than silently lost. Offered as one tap, never applied
 * automatically: it is inferred money, and this app does not post inferred
 * money to a ledger without the user agreeing.
 */
function HiddenFeeNotice({
  candidate,
  existingTransactions,
  onApply,
}: {
  candidate: ParsedCaptureCandidate;
  existingTransactions: import("@/lib/types").Transaction[];
  onApply: (fee: number) => void;
}) {
  const gap = useMemo(
    () => pendingReviewGap(candidate, existingTransactions),
    [candidate, existingTransactions],
  );

  // Only a shortfall is a fee. A positive gap is unrecorded money arriving,
  // which is a different problem and not one to guess at.
  const fee = gap && gap.gap < 0 ? Math.abs(gap.gap) : 0;
  if (fee === 0) {
    return null;
  }

  const alreadyApplied = candidate.feeAmount === fee;

  return (
    <div className="grid gap-2 rounded-lg border border-clay/40 bg-clay/10 px-3 py-2.5">
      <div className="text-xs leading-5 text-foreground">
        The stated balance is {formatMoney(fee, "UGX")} lower than this transaction explains —
        most likely a charge the message does not print.
      </div>
      {alreadyApplied ? (
        <div className="text-xs font-medium text-foreground">
          Recorded as a {formatMoney(fee, "UGX")} fee.
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => onApply(fee)}>
          Add {formatMoney(fee, "UGX")} as a fee
        </Button>
      )}
    </div>
  );
}

export function TextCapturePanel({
  accounts,
  categories,
  existingTransactions,
  isSubmitting,
  initialInput,
  onSaveCaptured,
  embedded,
}: Props) {
  const {
    input,
    setInput,
    source,
    setSource,
    accountId,
    setAccountId,
    fallbackFxRate,
    setFallbackFxRate,
    candidates,
    isExtractingFiles,
    fileError,
    accountSelectOptions,
    typeOptions,
    captureSourceOptions,
    parseMessages,
    appendFiles,
    resetReview,
    updateCandidate,
  } = useTextCapturePanel({ accounts, categories, existingTransactions, initialInput });

  const [detailsOpen, setDetailsOpen] = useState(Boolean(fallbackFxRate));

  async function handleSave() {
    await onSaveCaptured(candidates);
    resetReview();
    setInput("");
  }

  const content = (
    <div className="grid gap-4">
        <TextareaField
          id="capture-input"
          label="Paste messages"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            "Example:\nReceived UGX 500,000 from Employer Ltd on 27-03-2026\n\nPaid USh 45,000 to Grocery store on 06-04-2026"
          }
          className="min-h-32"
        />

        <SelectField
          id="capture-account"
          label="Post to account"
          value={accountId || accounts[0]?.id || ""}
          options={accountSelectOptions}
          onValueChange={setAccountId}
        />

        {detailsOpen ? (
          <div className="grid gap-3 pt-4 sm:grid-cols-2">
            <SelectField
              id="capture-source"
              label="Source"
              value={source}
              options={captureSourceOptions}
              onValueChange={(value) => setSource(value as TransactionSource)}
            />
            <InputField
              id="capture-fx"
              label="Exchange rate to UGX"
              inputMode="decimal"
              value={fallbackFxRate}
              onChange={(event) => setFallbackFxRate(event.target.value)}
              hint="Only used when a message isn't in UGX and states no rate."
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="w-fit text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Add details — source, exchange rate
          </button>
        )}

        <div className="grid gap-2">
          <InputField
            id="capture-files"
            label="Image or document"
            type="file"
            accept="image/*,.pdf,text/plain,text/csv"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) {
                void appendFiles(files);
              }
              event.target.value = "";
            }}
            hint="Upload screenshots, PDFs, or text files to extract transaction text into the same review flow."
          />
          {isExtractingFiles ? (
            <div className="text-xs text-muted-foreground">Extracting text from file…</div>
          ) : null}
          {fileError ? <div className="text-xs text-destructive">{fileError}</div> : null}
        </div>

        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={!input.trim()} onClick={parseMessages}>
            Parse messages
          </Button>
          {candidates.length > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={resetReview}>
              Clear review
            </Button>
          ) : null}
        </div>

        {candidates.length === 0 ? (
          <EmptyState className="py-6">
            Paste one or more money messages (separate each with a blank line) and Moat will read them.
          </EmptyState>
        ) : (
          <div className="grid gap-3">
            {candidates.map((candidate, index) => (
              <div key={candidate.id} className="grid gap-3 px-4 py-4">
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

                <HiddenFeeNotice
                  candidate={candidate}
                  existingTransactions={existingTransactions}
                  onApply={(fee) =>
                    updateCandidate(candidate.id, (entry) => ({ ...entry, feeAmount: fee }))
                  }
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <SelectField
                    id={`capture-type-${candidate.id}`}
                    label="Type"
                    value={candidate.type}
                    options={typeOptions}
                    onValueChange={(value) =>
                      updateCandidate(candidate.id, (entry) => ({
                        ...entry,
                        type: value as Exclude<TransactionType, "transfer">,
                        categoryId: coerceCategoryForType(
                          categories,
                          value as TransactionType,
                          entry.categoryId,
                        ),
                      }))
                    }
                  />
                  <SelectField
                    id={`capture-category-${candidate.id}`}
                    label="Category"
                    value={candidate.categoryId}
                    options={categoryOptions(categories)}
                    onValueChange={(value) =>
                      updateCandidate(candidate.id, (entry) => ({ ...entry, categoryId: value }))
                    }
                  />
                  <InputField
                    id={`capture-date-${candidate.id}`}
                    label="Date"
                    value={candidate.occurredOn}
                    onChange={(event) =>
                      updateCandidate(candidate.id, (entry) => ({ ...entry, occurredOn: event.target.value }))
                    }
                  />
                  <InputField
                    id={`capture-payee-${candidate.id}`}
                    label="Payee / source"
                    value={candidate.payee}
                    onChange={(event) =>
                      updateCandidate(candidate.id, (entry) => ({ ...entry, payee: event.target.value }))
                    }
                  />
                  <AmountField
                    id={`capture-amount-${candidate.id}`}
                    label={`Amount (${candidate.currency})`}
                    value={candidate.originalAmount}
                    onValueChange={(value) =>
                      updateCandidate(candidate.id, (entry) => ({
                        ...entry,
                        originalAmount: value ?? 0,
                      }))
                    }
                  />
                  {candidate.currency !== "UGX" ? (
                    <AmountField
                      id={`capture-fx-rate-${candidate.id}`}
                      label="FX rate to UGX"
                      value={candidate.fxRateToUgx}
                      onValueChange={(value) =>
                        updateCandidate(candidate.id, (entry) => ({
                          ...entry,
                          fxRateToUgx: value ?? undefined,
                        }))
                      }
                    />
                  ) : null}
                </div>

                <TextareaField
                  id={`capture-note-${candidate.id}`}
                  label="Note"
                  value={candidate.note}
                  onChange={(event) =>
                    updateCandidate(candidate.id, (entry) => ({ ...entry, note: event.target.value }))
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
                Send to review
              </Button>
            </div>
          </div>
        )}
    </div>
  );

  if (embedded) {
    return (
      <div>
        <AccentCardHeader tone="sage" title="From a message" className="rounded-none" />
        <div className="px-4 pt-4 pb-6">{content}</div>
      </div>
    );
  }

  // In the capture workspace the page title and method tabs already frame this,
  // so render bare — matching the manual form.
  return content;
}
