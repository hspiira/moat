export type AccountType =
  | "cash"
  | "mobile_money"
  | "bank"
  | "sacco"
  | "investment"
  | "debt";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "savings_contribution"
  | "debt_payment";

export type GoalType =
  | "emergency_fund"
  | "rent_buffer"
  | "school_fees"
  | "land_savings"
  | "business_capital"
  | "education"
  | "house_construction";

export type ProductHighlight = {
  label: string;
  value: string;
};

export type AppSection = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
};

export type Milestone = {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  outputs: string[];
};

export type UserProfile = {
  id: string;
  displayName: string;
  currency: "UGX";
  salaryCycle: "month_end" | "mid_month" | "custom";
  primaryIncomeType: "salary" | "salary_plus_side_income" | "services";
  riskComfort: "low" | "moderate" | "high";
  investmentHorizonMonths: number;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  institutionName?: string;
  balance: number;
  notes?: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  occurredOn: string;
  categoryId: string;
  note?: string;
  transferGroupId?: string;
};

export type Category = {
  id: string;
  name: string;
  kind: "income" | "expense" | "savings" | "transfer";
  isDefault: boolean;
};

export type Goal = {
  id: string;
  name: string;
  goalType: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: number;
  linkedAccountId?: string;
};

export type ResourceLink = {
  id: string;
  title: string;
  sourceName: string;
  url: string;
  topic: string;
  isOfficial: boolean;
};
