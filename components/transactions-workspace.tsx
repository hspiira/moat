"use client";

import { BudgetManagerPanel } from "@/components/budgets/budget-manager-panel";
import { Card, CardContent } from "@/components/ui/card";

import { TransactionForm } from "./transactions/transaction-form";
import { CsvImportPanel } from "./transactions/csv-import-panel";
import { MonthClosePanel } from "./transactions/month-close-panel";
import { RecurringObligationsPanel } from "./transactions/recurring-obligations-panel";
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
    recurringObligations,
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
    setError,
    setTransactionForm,
    setBudgetForm,
    loadWorkspace,
    refreshMonthCloseState,
    handleTransactionSubmit,
    beginTransactionEdit,
    handleDeleteTransaction,
    saveRule,
    toggleRule,
    saveObligation,
    toggleObligation,
    closeMonth,
    exportMonthClose,
    saveBudget,
    cancelEdit,
  } = useTransactionsWorkspace();

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Record income, expenses, transfers, and savings in one clean stream.
          </p>
        </div>
        {transactions.length > 0 ? (
          <div className="moat-panel-yellow border border-border/20 px-4 py-3 text-right text-sm text-muted-foreground">
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              {transactions.length}
            </div>
            <div className="text-xs">recorded</div>
          </div>
        ) : null}
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-none">
          <CardContent className="px-5 py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Loading transactions...
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !profile ? (
        <Card className="border-border/40 shadow-none">
          <CardContent className="px-5 py-8 text-sm text-muted-foreground">
            Complete onboarding and add at least one account before recording transactions.{" "}
            <a href="/onboarding" className="underline underline-offset-4 hover:text-foreground">
              Get started
            </a>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && profile ? (
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <TransactionForm
              accounts={accounts}
              categories={categories}
              form={transactionForm}
              editingId={editingTransactionId}
              isSubmitting={isSubmitting}
              lastSavedAt={lastSavedAt}
              successMessage={successMessage}
              onFormChange={setTransactionForm}
              onSubmit={(e) => void handleTransactionSubmit(e)}
              onCancelEdit={cancelEdit}
            />

            <div className="grid gap-5 content-start">
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
              obligations={recurringObligations}
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
          />
        </div>
      ) : null}
    </div>
  );
}
