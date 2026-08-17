"use client";

// Orchestrates the main transactions workspace: loads ledger data, handles
// capture intake, and derives month-close state for the UI. Budget and
// rule/obligation slices live in their own hooks; transaction construction
// and the month-close CSV are pure modules with their own tests.

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { announceLocalSave } from "@/lib/local-save";
import { repositories } from "@/lib/repositories/instance";
import { persistReviewedCaptureCandidates } from "@/lib/capture/persistence";
import type { ParsedCaptureCandidate } from "@/lib/capture/message-parser";
import { getOpenCaptureReviewItems } from "@/lib/capture/review-queue";
import {
  getRememberedFxDefault,
  normalizePayeeKey,
  saveFxMemory,
} from "@/lib/preferences/fx-memory";
import { readDebtPlannerSettings } from "@/lib/preferences/debt-planner";
import type {
  Account,
  CaptureReviewItem,
  Category,
  CategoryKind,
  Transaction,
  TransactionLineItem,
  UserProfile,
} from "@/lib/types";
import { reconcileAccountBalances } from "@/lib/domain/accounts";
import { reconcileDefaultAccounts } from "@/lib/app-state/default-accounts";
import { findTransactionTypeDrift } from "@/lib/domain/transaction-type-drift";
import { describeTransferCounterparty } from "@/lib/domain/transfer-counterparty";
import { planLineItemCascade } from "@/lib/domain/line-item-cascade";
import {
  buildSuggestedRecurringObligations,
  evaluateRecurringObligations,
} from "@/lib/domain/recurring";
import {
  evaluateMonthClose,
  getUnresolvedTransactions,
} from "@/lib/domain/reconciliation";
import { getSummaryForTransactions } from "@/lib/domain/summaries";

import { categoryMatchesType } from "@/lib/domain/transaction-classification";
import { countCategoryUsage } from "@/lib/domain/category-usage";
import { currentMonthIso, todayIso } from "@/lib/today";
import { isReservedAccount } from "@/lib/domain/reserved-accounts";
import { createDefaultTransactionForm, type TransactionFormState } from "./transaction-form";
import { useCounterparties } from "./use-counterparties";
import { useLineItems } from "./use-line-items";
import { useMonthClose } from "./use-month-close";
export type CaptureIntent = "expense" | "income" | "transfer" | "import" | "text" | null;
import {
  buildDebtPaymentTransactions,
  buildFeeTransaction,
  buildManualTransaction,
  buildTransferPair,
} from "./transaction-builder";
import {
  feesCategoryId,
  ensureFeesCategory,
  reconcileDefaultCategories,
} from "@/lib/app-state/defaults";
import { useBudgetPlanner, type BudgetFormState } from "./use-budget-planner";
import { useRulesAndObligations } from "./use-rules-and-obligations";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { createId } from "@/lib/ids";
import {
  isEditableTransaction,
  planTransactionCascade,
  transactionGroup,
  transferLegs,
} from "@/lib/domain/transaction-cascade";

export type { BudgetFormState };

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => {
    if (a.occurredOn === b.occurredOn) return b.createdAt.localeCompare(a.createdAt);
    return b.occurredOn.localeCompare(a.occurredOn);
  });
}

/**
 * Accounts an ordinary transaction may default to.
 *
 * The party-ledger pools are seeded for everyone and can sort ahead of the
 * user's own accounts, so defaulting to one files ordinary spending against the
 * lending or borrowing ledger. They stay selectable, just never preselected.
 */
/** The fee recorded against a payment, if there is one. */
function findFeeFor(transactions: Transaction[], parentId: string): Transaction | undefined {
  return transactions.find((entry) => entry.feeParentId === parentId);
}

function selectableAccounts(accounts: Account[]): Account[] {
  const spendable = accounts.filter(
    (account) => !isReservedAccount(account) && !account.isArchived,
  );
  return spendable.length > 0 ? spendable : accounts;
}

function getResetTransactionForm(
  accounts: Account[],
  categories: Category[],
): TransactionFormState {
  const base = createDefaultTransactionForm();
  // Skip the party-ledger pools: they are seeded for everyone and sort ahead of
  // the user's own accounts, so defaulting to one files ordinary spending
  // against the lending or borrowing ledger.
  const selectable = selectableAccounts(accounts);

  return {
    ...base,
    accountId: selectable[0]?.id ?? "",
    destinationAccountId: selectable[1]?.id ?? selectable[0]?.id ?? "",
    categoryId:
      categories.find((category) => categoryMatchesType(category, base.type))?.id ?? "",
    currency: "UGX",
    payee: "",
    fxRateToUgx: "",
  };
}

export function useTransactionsWorkspace() {
  const searchParams = useSearchParams();
  const { show } = useToast();
  const closePeriod = currentMonthIso();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);
  const [pendingSyncTransactionIds, setPendingSyncTransactionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { counterparties, setCounterparties, loadAndBackfill, resolveSelection } =
    useCounterparties();
  const [captureReviewItems, setCaptureReviewItems] = useState<CaptureReviewItem[]>([]);
  const [transactionForm, setTransactionForm] =
    useState<TransactionFormState>(createDefaultTransactionForm);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rememberedFxHint, setRememberedFxHint] = useState<string | null>(null);
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent>(null);
  const [sharedCaptureInput, setSharedCaptureInput] = useState("");
  const debtPlannerSettings = useMemo(() => readDebtPlannerSettings(), []);

  const {
    monthClose,
    setMonthClose,
    monthCloseEvaluation,
    setMonthCloseEvaluation,
    refreshMonthCloseState,
    closeMonth,
    exportMonthClose,
  } = useMonthClose({
    profile,
    closePeriod,
    transactions,
    categories,
    debtPlannerSettings,
    onMutated: () => loadWorkspaceRef.current(),
    setIsSubmitting,
    show,
  });

  const budgetPlanner = useBudgetPlanner({
    profile,
    categories,
    closePeriod,
    onMutated: () => loadWorkspaceRef.current(),
    setIsSubmitting,
  });
  const rulesAndObligations = useRulesAndObligations({
    profile,
    onMutated: () => loadWorkspaceRef.current(),
    onObligationsChanged: refreshMonthCloseState,
    setIsSubmitting,
  });
  const { setBudgets, setBudgetForm } = budgetPlanner;
  const { setTransactionRules, setRecurringObligations } = rulesAndObligations;

  const suggestedRecurringObligations = useMemo(
    () =>
      buildSuggestedRecurringObligations(
        accounts,
        transactions,
        debtPlannerSettings.strategy,
        debtPlannerSettings.extraMonthlyPayment,
      ),
    [accounts, debtPlannerSettings.extraMonthlyPayment, debtPlannerSettings.strategy, transactions],
  );

  const recurringEvaluations = useMemo(
    () =>
      evaluateRecurringObligations(
        [...rulesAndObligations.recurringObligations, ...suggestedRecurringObligations],
        transactions,
        closePeriod,
      ),
    [closePeriod, rulesAndObligations.recurringObligations, suggestedRecurringObligations, transactions],
  );

  const periodTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.occurredOn.startsWith(closePeriod)),
    [closePeriod, transactions],
  );

  const periodSummary = useMemo(
    () => getSummaryForTransactions(periodTransactions, categories),
    [categories, periodTransactions],
  );

  // One definition of "unresolved", shared with month close. This used to count
  // "reviewed" as well, and an approved capture is written as "reviewed" — so
  // every capture you approved permanently incremented "Needs review".
  const reviewCount = useMemo(
    () => getUnresolvedTransactions(periodTransactions).length,
    [periodTransactions],
  );

  const captureReviewCount = useMemo(
    () => getOpenCaptureReviewItems(captureReviewItems).length,
    [captureReviewItems],
  );

  const duplicateCount = useMemo(
    () => monthCloseEvaluation.duplicateGroups.length,
    [monthCloseEvaluation.duplicateGroups.length],
  );

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await repositories.userProfile.get();
      setProfile(nextProfile);

      if (!nextProfile) {
        setAccounts([]);
        setCategories([]);
        setTransactions([]);
        setLineItems([]);
        setCounterparties([]);
        setBudgets([]);
        setCaptureReviewItems([]);
        setTransactionRules([]);
        setRecurringObligations([]);
        setMonthClose(null);
        return;
      }

      const [storedAccounts, storedCategories, storedTransactions, storedLineItems] =
        await Promise.all([
          repositories.accounts.listByUser(nextProfile.id),
          repositories.categories.listByUser(nextProfile.id),
          repositories.transactions.listByUser(nextProfile.id),
          repositories.transactionLineItems.listByUser(nextProfile.id),
        ]);
      const [
        storedCaptureReviewItems,
        storedRules,
        storedObligations,
        storedMonthClose,
        storedBudgets,
        storedSyncProfile,
        storedOutbox,
      ] = await Promise.all([
        repositories.captureReviewItems.listByUser(nextProfile.id),
        repositories.transactionRules.listByUser(nextProfile.id),
        repositories.recurringObligations.listByUser(nextProfile.id),
        repositories.monthCloses.getByPeriod(nextProfile.id, closePeriod),
        repositories.budgets.listByMonth(nextProfile.id, closePeriod),
        repositories.syncProfiles.getByUser(nextProfile.id),
        repositories.syncOutbox.listByUser(nextProfile.id),
      ]);

      // Only meaningful when hosted sync is on; otherwise nothing is "waiting".
      const syncEnabled =
        storedSyncProfile?.hostedSyncEnabled && storedSyncProfile.mode === "hosted_opt_in";
      setPendingSyncTransactionIds(
        syncEnabled
          ? new Set(
              storedOutbox
                .filter(
                  (item) =>
                    item.entityType === "transaction" &&
                    (item.status === "pending" || item.status === "failed"),
                )
                .map((item) => item.entityId),
            )
          : new Set(),
      );

      const accountSeeds = reconcileDefaultAccounts(
        storedAccounts,
        nextProfile.id,
        new Date().toISOString(),
      );
      if (accountSeeds.length > 0) {
        await Promise.all(accountSeeds.map((account) => repositories.accounts.upsert(account)));
      }

      // Reconcile in memory for display only. Loading is a read — persisting
      // balances here would churn storage and the sync outbox on every view.
      const reconciledAccounts = reconcileAccountBalances(
        [...storedAccounts, ...accountSeeds],
        storedTransactions,
      );

      // Seeded categories do get written, because a stale kind is not cosmetic:
      // "Debt repayment" seeded as an expense leaves a debt payment with no
      // valid category at all. Returns nothing once a device is current, so
      // this is a one-off write rather than churn on every load.
      const categoryFixes = reconcileDefaultCategories(storedCategories, nextProfile.id);
      if (categoryFixes.length > 0) {
        await Promise.all(categoryFixes.map((category) => repositories.categories.upsert(category)));
      }
      const currentCategories =
        categoryFixes.length > 0
          ? await repositories.categories.listByUser(nextProfile.id)
          : storedCategories;

      const backfilled = await loadAndBackfill(nextProfile.id, storedTransactions);

      // Repairs rows left carrying a type their category no longer permits,
      // which assertCategoryMatchesType rejects on save.
      const drift = findTransactionTypeDrift(
        backfilled,
        currentCategories,
        new Date().toISOString(),
      );
      if (drift.repaired.length > 0) {
        await Promise.all(
          drift.repaired.map((entry) => repositories.transactions.upsert(entry)),
        );
      }
      if (drift.needsReview.length > 0) {
        console.warn(
          `Moat: ${drift.needsReview.length} transaction(s) have a category their type cannot use and need a manual fix.`,
          drift.needsReview.map((entry) => entry.id),
        );
      }
      const repairedById = new Map(drift.repaired.map((entry) => [entry.id, entry]));
      const currentTransactions = backfilled.map((entry) => repairedById.get(entry.id) ?? entry);

      setAccounts(reconciledAccounts);
      setCategories(currentCategories);
      setTransactions(sortTransactions(currentTransactions));
      setLineItems(storedLineItems);
      setBudgets(storedBudgets);
      setCaptureReviewItems(storedCaptureReviewItems);
      setTransactionRules(storedRules);
      setRecurringObligations(storedObligations);
      setMonthClose(storedMonthClose);

      const nextRecurringEvaluations = evaluateRecurringObligations(
        storedObligations,
        storedTransactions,
        closePeriod,
      );
      setMonthCloseEvaluation(
        evaluateMonthClose(
          storedTransactions.filter((transaction) => transaction.occurredOn.startsWith(closePeriod)),
          storedCategories,
          nextRecurringEvaluations.map((evaluation) => ({
            obligation: evaluation.obligation,
            status:
              evaluation.state === "paid"
                ? "paid"
                : evaluation.state === "partial"
                  ? "partial"
                  : "missing",
          })),
        ),
      );

      const defaultAccounts = selectableAccounts(reconciledAccounts);
      setTransactionForm((current) => ({
        ...getResetTransactionForm(reconciledAccounts, storedCategories),
        ...current,
        accountId: current.accountId || defaultAccounts[0]?.id || "",
        destinationAccountId: current.destinationAccountId || defaultAccounts[1]?.id || "",
        categoryId:
          current.categoryId ||
          storedCategories.find((category) => categoryMatchesType(category, current.type))?.id ||
          "",
      }));
      setBudgetForm((current) => ({
        ...current,
        categoryId:
          current.categoryId ||
          storedCategories.find((category) => category.kind === "expense")?.id ||
          "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load transactions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [
    closePeriod,
    loadAndBackfill,
    setBudgetForm,
    setBudgets,
    setCounterparties,
    setMonthClose,
    setMonthCloseEvaluation,
    setRecurringObligations,
    setTransactionRules,
  ]);

  // Stable indirection so the sub-hooks can trigger a reload without a
  // circular dependency between hook definitions.
  const loadWorkspaceRef = useLatest(loadWorkspace);

  useEffect(() => {
    startTransition(() => {
      void loadWorkspace();
    });
  }, [loadWorkspace]);

  useEffect(() => {
    const capture = searchParams.get("capture");
    const type = searchParams.get("type");
    const accountId = searchParams.get("accountId");
    const amount = searchParams.get("amount");
    const payee = searchParams.get("payee");
    const sharedTitle = searchParams.get("title");
    const sharedText = searchParams.get("text");
    const sharedUrl = searchParams.get("url");
    const nextSharedInput = [sharedTitle, sharedText, sharedUrl].filter(Boolean).join("\n");
    const nextCaptureIntent: CaptureIntent =
      capture === "expense" ||
      capture === "income" ||
      capture === "transfer" ||
      capture === "import" ||
      capture === "text"
        ? capture
        : nextSharedInput
          ? "text"
          : null;

    setCaptureIntent(nextCaptureIntent);
    setSharedCaptureInput(nextSharedInput);

    if (!capture && !type && !accountId && !amount && !payee && !nextSharedInput) return;

    setTransactionForm((current) => ({
      ...current,
      type: (type as TransactionFormState["type"]) || current.type,
      accountId: accountId || current.accountId,
      amount: amount || current.amount,
      payee: payee || current.payee,
      categoryId:
        categories.find((category) =>
          categoryMatchesType(category, (type as TransactionFormState["type"]) || current.type),
        )?.id ?? current.categoryId,
    }));
  }, [categories, searchParams]);

  /**
   * Keep the default date on today while the app stays open.
   *
   * The form can sit on screen for days — an installed PWA is rarely closed —
   * and the date it was created with would otherwise still be offered after
   * midnight. Only a date the app stamped itself is moved; once the user picks
   * one it is left alone, so recording yesterday's spending still works.
   */
  const autoStampedDate = useRef(todayIso());
  useEffect(() => {
    const refresh = () => {
      const today = todayIso();
      if (autoStampedDate.current === today) return;
      const previous = autoStampedDate.current;
      autoStampedDate.current = today;
      if (editingTransactionId) return;
      setTransactionForm((current) =>
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
  }, [editingTransactionId]);

  useEffect(() => {
    if (transactionForm.currency === "UGX") {
      setRememberedFxHint(null);
      return;
    }

    const payee = transactionForm.payee.trim();
    if (!payee) {
      setRememberedFxHint(null);
      return;
    }

    const memory = getRememberedFxDefault(payee, transactionForm.currency);
    if (!memory) {
      setRememberedFxHint(null);
      return;
    }

    setRememberedFxHint(memory.hint);
    setTransactionForm((current) => {
      if (current.fxRateToUgx) return current;
      if (current.currency !== memory.currency) return current;
      if (normalizePayeeKey(current.payee) !== memory.payeeKey) return current;
      return { ...current, fxRateToUgx: String(memory.rateToUgx) };
    });
  }, [transactionForm.currency, transactionForm.payee]);

  /**
   * Persists reconciled balances after a ledger mutation. Only accounts
   * whose stored balance actually changed are written, so the sync outbox
   * is not flooded with no-op upserts.
   */
  const persistReconciledBalances = useCallback(async (userId: string) => {
    const storedAccounts = await repositories.accounts.listByUser(userId);
    const storedTransactions = await repositories.transactions.listByUser(userId);
    const reconciled = reconcileAccountBalances(storedAccounts, storedTransactions);
    const storedBalances = new Map(storedAccounts.map((account) => [account.id, account.balance]));
    const changed = reconciled.filter(
      (account) => storedBalances.get(account.id) !== account.balance,
    );
    await Promise.all(changed.map((account) => repositories.accounts.upsert(account)));
  }, []);

  const resolveFormCounterparty = useCallback(
    (userId: string, timestamp: string) =>
      resolveSelection({
        userId,
        timestamp,
        direction: describeTransferCounterparty(
          accounts,
          transactionForm.accountId,
          transactionForm.destinationAccountId,
        )?.direction,
        selection: transactionForm,
      }),
    [accounts, resolveSelection, transactionForm],
  );

  const handleTransactionSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!profile) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const timestamp = new Date().toISOString();
        const wasEditing = Boolean(editingTransactionId);
        const buildInput = {
          form: transactionForm,
          userId: profile.id,
          timestamp,
          editingTransactionId,
          existingTransactions: transactions,
        };

        // The rows the previous shape wrote. A category can change the type, so
        // an edit may produce a different set of rows than it started with: an
        // expense becoming a transfer, or a transfer becoming an expense. What
        // the old shape wrote and the new one does not has to go, or the ledger
        // keeps a row nothing points at.
        const editedRow = editingTransactionId
          ? transactions.find((entry) => entry.id === editingTransactionId)
          : undefined;
        const previousRowIds = new Set(
          editedRow ? transactionGroup(editedRow, transactions).map((entry) => entry.id) : [],
        );
        // A fee hangs off one of those rows, whichever it was.
        const previousFee = transactions.find(
          (entry) => entry.feeParentId && previousRowIds.has(entry.feeParentId),
        );

        let rows: Transaction[];
        if (transactionForm.type === "transfer") {
          const party = await resolveFormCounterparty(profile.id, timestamp);
          const stamp = (row: Transaction): Transaction =>
            party ? { ...row, counterpartyId: party.id, payee: party.name } : row;
          rows = buildTransferPair(buildInput).map(stamp);
        } else if (transactionForm.type === "debt_payment") {
          // Split into an interest expense and a principal transfer. The user
          // enters one payment and taps nothing extra; the rate and balance on
          // the loan supply the rest.
          const loan = accounts.find(
            (account) => account.id === transactionForm.destinationAccountId,
          );
          if (!loan) {
            throw new Error("Choose which loan you are paying.");
          }
          rows = buildDebtPaymentTransactions(buildInput, loan);
        } else {
          const rules = await repositories.transactionRules.listByUser(profile.id);
          // Passing the catalogue makes the type/category pair a write-time
          // check, not just something the picker happens to hide.
          rows = [buildManualTransaction(buildInput, rules, categories)];
        }

        // A fee is a separate linked expense on the same account (the transfer
        // source, for transfers), tied to its payment by feeParentId. Reusing
        // the previous fee's id repoints it at the new parent instead of
        // leaving it behind pointing at a row that no longer exists.
        const feeParent = rows[0];
        const fee = buildFeeTransaction(
          feeParent,
          transactionForm.feeAmount,
          feesCategoryId(feeParent.userId),
          previousFee,
        );

        // Everything is built and validated before the first write, so a bad
        // form leaves storage untouched.
        await Promise.all(rows.map((row) => repositories.transactions.upsert(row)));
        if (fee) {
          const feesCategory = ensureFeesCategory(categories, profile.id);
          if (feesCategory) {
            await repositories.categories.upsert(feesCategory);
          }
          await repositories.transactions.upsert(fee);
        }

        // Prune after writing, never before: an interruption then leaves a
        // visible duplicate rather than a hole where the money was.
        const writtenIds = new Set([...rows.map((row) => row.id), ...(fee ? [fee.id] : [])]);
        const stale = [...previousRowIds].filter((id) => !writtenIds.has(id));
        if (previousFee && !fee) {
          stale.push(previousFee.id);
        }
        await Promise.all(stale.map((id) => repositories.transactions.remove(id)));

        await persistReconciledBalances(profile.id);
        await refreshMonthCloseState(profile.id);
        if (transactionForm.currency !== "UGX" && transactionForm.payee.trim()) {
          saveFxMemory({
            payeeKey: normalizePayeeKey(transactionForm.payee),
            displayPayee: transactionForm.payee.trim(),
            currency: transactionForm.currency,
            rateToUgx: Number(transactionForm.fxRateToUgx),
            updatedAt: timestamp,
          });
        }
        const message = wasEditing ? "Transaction updated locally" : "Transaction saved locally";
        setLastSavedAt(timestamp);
        setSuccessMessage(message);
        announceLocalSave({ entity: "transactions", savedAt: timestamp, message });
        show(wasEditing ? "Transaction updated." : "Transaction saved.", "success");
        setEditingTransactionId(null);
        setTransactionForm(getResetTransactionForm(accounts, categories));
        await loadWorkspace();
      } catch (submitError) {
        const message = errorMessage(submitError, "Couldn't save the transaction.");
        setError(message);
        show(message, "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      accounts,
      categories,
      editingTransactionId,
      loadWorkspace,
      persistReconciledBalances,
      profile,
      refreshMonthCloseState,
      resolveFormCounterparty,
      show,
      transactionForm,
      transactions,
    ],
  );

  /**
   * Makes a category the user asked for while recording. The kind comes from
   * the movement in play, so the new category is valid for this transaction at
   * once. Selecting it is left to the caller, which knows the form.
   */
  const createCategory = useCallback(
    async (name: string, kind: CategoryKind): Promise<Category | null> => {
      if (!profile) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;

      const existing = categories.find(
        (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;

      const category: Category = {
        id: createId(),
        userId: profile.id,
        name: trimmed,
        kind,
        isDefault: false,
        createdAt: new Date().toISOString(),
      };

      await repositories.categories.upsert(category);
      setCategories((current) => [...current, category]);
      return category;
    },
    [categories, profile],
  );

  /** Transactions per categoryId, so the picker lists common ones first. */
  const categoryUsage = useMemo(() => countCategoryUsage(transactions), [transactions]);

  const beginTransactionEdit = useCallback(
    (transaction: Transaction) => {
      // A loan repayment carries an interest leg whose split cannot be
      // recomputed against a balance that has since moved.
      if (!isEditableTransaction(transaction, transactions)) {
        return;
      }

      if (transaction.type === "transfer") {
        const legs = transferLegs(transaction, transactions);
        if (!legs) return;
        const { source, destination } = legs;
        // Edit through the source leg: its id is what the fee hangs off, and
        // rebuilding reuses the group so both legs are overwritten in place.
        const feeOnSource = findFeeFor(transactions, source.id);
        setEditingTransactionId(source.id);
        setTransactionForm({
          type: "transfer",
          accountId: source.accountId,
          destinationAccountId: destination.accountId,
          categoryId: source.categoryId,
          currency: source.currency,
          payee: source.payee ?? source.rawPayee ?? "",
          counterpartyId: source.counterpartyId ?? destination.counterpartyId ?? "",
          counterpartyName: "",
          amount: String(Math.abs(source.originalAmount)),
          fxRateToUgx: source.fxRateToUgx ? String(source.fxRateToUgx) : "",
          feeAmount: feeOnSource ? String(feeOnSource.originalAmount) : "",
          occurredOn: source.occurredOn,
          expectedRepaymentDate:
            source.expectedRepaymentDate ?? destination.expectedRepaymentDate ?? "",
          note: source.note ?? "",
        });
        return;
      }

      const feeChild = findFeeFor(transactions, transaction.id);
      setEditingTransactionId(transaction.id);
      setTransactionForm({
        type: transaction.type,
        accountId: transaction.accountId,
        destinationAccountId: "",
        categoryId: transaction.categoryId,
        currency: transaction.currency,
        payee: transaction.payee ?? transaction.rawPayee ?? "",
        counterpartyId: transaction.counterpartyId ?? "",
        counterpartyName: "",
        amount: String(transaction.originalAmount),
        fxRateToUgx: transaction.fxRateToUgx ? String(transaction.fxRateToUgx) : "",
        feeAmount: feeChild ? String(feeChild.originalAmount) : "",
        occurredOn: transaction.occurredOn,
        // Only a transfer leg carries a due date, and that path returns above.
        expectedRepaymentDate: "",
        note: transaction.note ?? "",
      });
    },
    [transactions],
  );

  const handleDeleteTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!profile) return;
      setIsSubmitting(true);
      setError(null);

      try {
        const idsToRemove = planTransactionCascade(transaction, transactions);
        const [lineItems, plannedPurchases] = await Promise.all([
          repositories.transactionLineItems.listByUser(profile.id),
          repositories.plannedPurchases.listByUser(profile.id),
        ]);
        const cascade = planLineItemCascade({
          deletedTransactionIds: idsToRemove,
          lineItems,
          plannedPurchases,
          timestamp: new Date().toISOString(),
        });
        await Promise.all([
          ...[...idsToRemove].map((id) => repositories.transactions.remove(id)),
          ...cascade.lineItemIdsToDelete.map((id) =>
            repositories.transactionLineItems.remove(id),
          ),
          ...cascade.purchasesToRevert.map((purchase) =>
            repositories.plannedPurchases.upsert(purchase),
          ),
        ]);

        if (editingTransactionId === transaction.id) {
          setEditingTransactionId(null);
          setTransactionForm(createDefaultTransactionForm());
        }

        const timestamp = new Date().toISOString();
        const message = "Transaction deleted locally";
        setLastSavedAt(timestamp);
        setSuccessMessage(message);
        announceLocalSave({ entity: "transactions", savedAt: timestamp, message });
        show("Transaction deleted.", "success");
        await persistReconciledBalances(profile.id);
        await refreshMonthCloseState(profile.id);
        await loadWorkspace();
      } catch (deleteError) {
        const message = errorMessage(deleteError, "Couldn't delete the transaction.");
        setError(message);
        show(message, "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      editingTransactionId,
      loadWorkspace,
      persistReconciledBalances,
      profile,
      refreshMonthCloseState,
      show,
      transactions,
    ],
  );

  const saveCapturedTransactions = useCallback(
    async (candidates: ParsedCaptureCandidate[]) => {
      if (!profile || candidates.length === 0) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const result = await persistReviewedCaptureCandidates({
          repositories,
          userId: profile.id,
          candidates,
          source: sharedCaptureInput.trim() ? "shared_text" : "pasted_text",
        });
        await refreshMonthCloseState(profile.id);
        const message = "Captured items sent to review locally";
        setLastSavedAt(result.savedAt);
        setSuccessMessage(message);
        await loadWorkspace();
      } catch (captureError) {
        setError(
          captureError instanceof Error ? captureError.message : "Unable to save captured transactions.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadWorkspace, profile, refreshMonthCloseState, sharedCaptureInput],
  );

  const { saveLineItem, deleteLineItem } = useLineItems({
    profile,
    lineItems,
    onMutated: loadWorkspace,
    setIsSubmitting,
    setError,
    show,
  });

  return {
    closePeriod,
    profile,
    accounts,
    categories,
    counterparties,
    transactions,
    lineItems,
    pendingSyncTransactionIds,
    periodTransactions,
    periodSummary,
    reviewCount,
    captureReviewCount,
    duplicateCount,
    budgets: budgetPlanner.budgets,
    captureReviewItems,
    transactionRules: rulesAndObligations.transactionRules,
    recurringObligations: rulesAndObligations.recurringObligations,
    recurringEvaluations,
    monthClose,
    monthCloseEvaluation,
    transactionForm,
    budgetForm: budgetPlanner.budgetForm,
    editingTransactionId,
    isLoading,
    isSubmitting,
    error,
    lastSavedAt,
    successMessage,
    rememberedFxHint,
    captureIntent,
    sharedCaptureInput,
    setError,
    setTransactionForm,
    setBudgetForm,
    loadWorkspace,
    refreshMonthCloseState,
    handleTransactionSubmit,
    createCategory,
    categoryUsage,
    beginTransactionEdit,
    handleDeleteTransaction,
    saveCapturedTransactions,
    saveRule: rulesAndObligations.saveRule,
    toggleRule: rulesAndObligations.toggleRule,
    saveObligation: rulesAndObligations.saveObligation,
    toggleObligation: rulesAndObligations.toggleObligation,
    saveLineItem,
    deleteLineItem,
    closeMonth,
    exportMonthClose,
    saveBudget: budgetPlanner.saveBudget,
    editBudget: budgetPlanner.editBudget,
    deleteBudget: budgetPlanner.deleteBudget,
    cancelEdit: () => {
      setEditingTransactionId(null);
      setTransactionForm(getResetTransactionForm(accounts, categories));
    },
    cancelBudgetEdit: budgetPlanner.cancelBudgetEdit,
  };
}
