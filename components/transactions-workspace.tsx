"use client";

import { BudgetManagerPanel } from "@/components/budgets/budget-manager-panel";
import { MetricChip } from "@/components/page-shell/metric-chip";
import { PageHeader } from "@/components/page-shell/page-header";
import {
  ErrorStateCard,
  LoadingStateCard,
  SetupRequiredCard,
} from "@/components/page-shell/page-state";

import { TransactionForm } from "./transactions/transaction-form";
import { CsvImportPanel } from "./transactions/csv-import-panel";
import { MonthClosePanel } from "./transactions/month-close-panel";
import { CaptureIntentPanel } from "./transactions/capture-intent-panel";
import { RecurringObligationsPanel } from "./transactions/recurring-obligations-panel";
import { TextCapturePanel } from "./transactions/text-capture-panel";
import { TransactionList } from "./transactions/transaction-list";
import { TransactionRulesPanel } from "./transactions/transaction-rules-panel";
import { useTransactionsWorkspace } from "./transactions/use-transactions-workspace";

export function TransactionsWorkspace() {
  const {
    closePeriod,
    profile,
    accounts,
    categories,
    transactions,
    budgets,
    transactionRules,
    recurringEvaluations,
    monthClose,
    monthCloseEvaluation,
    transactionForm,
    budgetForm,
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
    beginTransactionEdit,
    handleDeleteTransaction,
    saveCapturedTransactions,
    saveRule,
    toggleRule,
    saveObligation,
    toggleObligation,
    closeMonth,
    exportMonthClose,
    saveBudget,
    editBudget,
    deleteBudget,
    cancelEdit,
    cancelBudgetEdit,
  } = useTransactionsWorkspace();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Transactions"
        description="Record income, expenses, transfers, and savings in one clean stream."
        aside={
          transactions.length > 0 ? (
            <MetricChip
              value={<span className="text-2xl font-semibold tracking-tight">{transactions.length}</span>}
              label="Recorded"
              className="moat-panel-yellow border-border/20"
            />
          ) : null
        }
      />

      {error ? <ErrorStateCard message={error} /> : null}
      {isLoading ? <LoadingStateCard message="Loading transactions..." /> : null}
      {!isLoading && !profile ? (
        <SetupRequiredCard
          message="Complete onboarding and add at least one account before recording transactions."
          href="/onboarding"
          cta="Get started"
        />
      ) : null}

      {!isLoading && profile ? (
        <div className="grid gap-5">
          <CaptureIntentPanel intent={captureIntent} />

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <TransactionForm
              accounts={accounts}
              categories={categories}
              form={transactionForm}
              editingId={editingTransactionId}
              isSubmitting={isSubmitting}
              lastSavedAt={lastSavedAt}
              successMessage={successMessage}
              rememberedFxHint={rememberedFxHint}
              onFormChange={setTransactionForm}
              onSubmit={(e) => void handleTransactionSubmit(e)}
              onCancelEdit={cancelEdit}
            />

            <div className="grid gap-5 content-start">
              <TextCapturePanel
                accounts={accounts}
                categories={categories}
                existingTransactions={transactions}
                isSubmitting={isSubmitting}
                active={captureIntent === "text"}
                initialInput={sharedCaptureInput}
                onSaveCaptured={saveCapturedTransactions}
              />

              <CsvImportPanel
                accounts={accounts}
                categories={categories}
                transactions={transactions}
                profile={profile}
                onImportSuccess={() => void loadWorkspace()}
                onError={setError}
              />

              <TransactionList
                accounts={accounts}
                categories={categories}
                transactions={transactions}
                isSubmitting={isSubmitting}
                onEdit={beginTransactionEdit}
                onDelete={(t) => void handleDeleteTransaction(t)}
              />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <TransactionRulesPanel
              accounts={accounts}
              categories={categories}
              rules={transactionRules}
              isSubmitting={isSubmitting}
              onSaveRule={(rule) => void saveRule(rule)}
              onToggleRule={(rule) => void toggleRule(rule)}
            />

            <RecurringObligationsPanel
              accounts={accounts}
              categories={categories}
              evaluations={recurringEvaluations}
              isSubmitting={isSubmitting}
              onSaveObligation={(obligation) => void saveObligation(obligation)}
              onToggleObligation={(obligation) => void toggleObligation(obligation)}
            />
          </div>

          <MonthClosePanel
            period={closePeriod}
            monthClose={monthClose}
            evaluation={monthCloseEvaluation}
            recurringEvaluations={recurringEvaluations}
            isSubmitting={isSubmitting}
            onRefresh={() => {
              if (profile) {
                void refreshMonthCloseState(profile.id);
              }
            }}
            onClose={() => void closeMonth()}
            onExport={exportMonthClose}
          />

          <BudgetManagerPanel
            month={closePeriod}
            categories={categories}
            budgets={budgets}
            transactions={transactions}
            form={budgetForm}
            isSubmitting={isSubmitting}
            onFormChange={setBudgetForm}
            onSave={() => void saveBudget()}
            onEdit={editBudget}
            onDelete={(budgetId) => void deleteBudget(budgetId)}
            onCancelEdit={cancelBudgetEdit}
          />
        </div>
      ) : null}
    </div>
  );
}
