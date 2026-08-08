import type {
  Account,
  AccountType,
  Category,
  DebtInterestModel,
  DebtLenderType,
  DebtRepaymentFrequency,
  GuidanceLevel,
  LiquidityNeed,
  RecurringObligation,
  RiskComfort,
  SupportedCurrency,
  TransactionSource,
  TransactionType,
} from "@/lib/types";
import type {
  SelectFieldOption,
  SelectFieldOptionGroup,
} from "@/components/forms/select-field";
import { supportedCurrencyLabels } from "@/lib/currency";
import {
  categoryKindLabels,
  categoryKindOrder,
} from "@/lib/domain/transaction-classification";
import { orderCategoriesForPicker } from "@/lib/domain/category-usage";

export const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  bank: "Bank Account",
  sacco: "SACCO",
  investment: "Investment",
  debt: "Debt / Obligation",
  // Distinct from the "Money lent out" pool account, so a user adding their own
  // per-borrower ledger cannot end up with two accounts of the same name.
  receivable: "Owed to you",
};

export const debtInterestModelLabels: Record<DebtInterestModel, string> = {
  reducing_balance: "Reducing balance",
  flat: "Flat rate",
};

export const debtLenderTypeLabels: Record<DebtLenderType, string> = {
  bank: "Bank",
  sacco: "SACCO",
  microfinance: "Microfinance",
  informal: "Informal",
};

export const debtRepaymentFrequencyLabels: Record<DebtRepaymentFrequency, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
};

export const transactionTypeLabels: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  savings_contribution: "Savings contribution",
  debt_payment: "Debt payment",
  transfer: "Transfer",
};

export const transactionSourceLabels: Record<TransactionSource, string> = {
  manual: "Manual",
  csv: "CSV",
  notification: "Notification",
  sms: "SMS",
};

export const supportedCurrencyOptionLabels: Record<SupportedCurrency, string> =
  supportedCurrencyLabels;

export const liquidityNeedLabels: Record<LiquidityNeed, string> = {
  immediate: "Immediate",
  near_term: "Near term",
  long_term: "Long term",
};

export const riskComfortLabels: Record<RiskComfort, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

export const guidanceLevelLabels: Record<GuidanceLevel, string> = {
  starter: "Starter",
  standard: "Standard",
  detailed: "Detailed",
};

export const recurringObligationTypeLabels: Record<RecurringObligation["type"], string> = {
  rent: "Rent",
  school_fees: "School fees",
  data_airtime: "Data / airtime",
  sacco_contribution: "SACCO contribution",
  salary: "Salary",
  loan_repayment: "Loan repayment",
};

export const recurringCadenceLabels: Record<RecurringObligation["cadence"], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export function optionsFromRecord<T extends string>(
  labels: Record<T, string>,
  values?: T[],
): SelectFieldOption[] {
  const keys = values ?? (Object.keys(labels) as T[]);
  return keys.map((value) => ({ value, label: labels[value] }));
}

export function accountOptions(accounts: Account[]): SelectFieldOption[] {
  return accounts.map((account) => ({ value: account.id, label: account.name }));
}

/**
 * Every category, grouped under its kind. Because the transaction type is
 * derived from the category, this one picker replaces the type dropdown as
 * well — so the headings have to carry the meaning the type used to.
 * Empty groups are dropped rather than rendered as bare headings.
 */
export function categoryOptionGroups(
  categories: Category[],
  usage: Map<string, number> = new Map(),
): SelectFieldOptionGroup[] {
  const ordered = orderCategoriesForPicker(categories, usage);

  return categoryKindOrder
    .map((kind) => ({
      label: categoryKindLabels[kind],
      options: categoryOptions(ordered.filter((category) => category.kind === kind)),
    }))
    .filter((group) => group.options.length > 0);
}

export function categoryOptions(categories: Category[]): SelectFieldOption[] {
  return categories.map((category) => ({ value: category.id, label: category.name }));
}

export function accountTypeOptions(accountTypes: AccountType[]): SelectFieldOption[] {
  return accountTypes.map((type) => ({ value: type, label: accountTypeLabels[type] }));
}
