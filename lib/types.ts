export type AccountType =
  | "cash"
  | "mobile_money"
  | "bank"
  | "sacco"
  | "investment"
  | "debt";

export type DebtInterestModel = "flat" | "reducing_balance";
export type DebtLenderType = "bank" | "sacco" | "microfinance" | "informal";
export type DebtRepaymentFrequency = "weekly" | "monthly";
export type SupportedCurrency = "UGX" | "USD" | "KES" | "TZS" | "RWF" | "EUR" | "GBP";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "savings_contribution"
  | "debt_payment";

export type ReconciliationState =
  | "draft"
  | "parsed"
  | "reviewed"
  | "posted"
  | "matched";

export type TransactionSource = "manual" | "csv" | "notification" | "sms";
export type CaptureEnvelopeSource = "pasted_text" | "shared_text" | "file_extract" | "notification";
export type CaptureReviewStatus =
  | "new"
  | "needs_review"
  | "duplicate"
  | "approved"
  | "rejected";
export type CaptureConfidenceField =
  | "amount"
  | "date"
  | "type"
  | "payee"
  | "currency"
  | "balance";
export type CaptureWarningLevel = "info" | "warning";
export type SyncMode = "local_only" | "hosted_opt_in";
export type SyncOutboxOperation = "upsert" | "remove";
export type SyncOutboxStatus = "pending" | "syncing" | "failed" | "synced" | "conflict";

export type GoalType =
  | "emergency_fund"
  | "rent_buffer"
  | "school_fees"
  | "land_savings"
  | "business_capital"
  | "education"
  | "house_construction";

export type CategoryKind = "income" | "expense" | "savings" | "transfer";

export type SalaryCycle = "month_end" | "mid_month" | "custom";

export type IncomeType = "salary" | "salary_plus_side_income" | "services";

export type RiskComfort = "low" | "moderate" | "high";

export type LiquidityNeed = "immediate" | "near_term" | "long_term";

export type GuidanceLevel = "starter" | "standard" | "detailed";

export type InstitutionType =
  | "bank"
  | "mobile_money"
  | "sacco"
  | "fund_manager"
  | "regulator"
  | "exchange"
  | "other";

export type ProductHighlight = {
  label: string;
  value: string;
};

export type NavItem = {
  href: string;
  label: string;
  description: string;
};

export type AppSection = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
};

export type ModulePreview = {
  href: string;
  title: string;
  summary: string;
  stage: string;
};

export type ModuleDetail = {
  eyebrow: string;
  title: string;
  description: string;
  intentTitle: string;
  intentSummary: string;
  intentBullets: string[];
  primaryCta: {
    href: string;
    label: string;
  };
  secondaryCta: {
    href: string;
    label: string;
  };
  scopeGroups: {
    title: string;
    summary: string;
    items: string[];
  }[];
  acceptanceGates: string[];
  issueNumber: number;
  issueHref: string;
  issueSummary: string;
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
  salaryCycle: SalaryCycle;
  primaryIncomeType: IncomeType;
  riskComfort: RiskComfort;
  investmentHorizonMonths: number;
  createdAt: string;
  updatedAt: string;
};

export type Account = {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  institutionName?: string;
  institutionType?: InstitutionType;
  openingBalance: number;
  balance: number;
  notes?: string;
  debtPrincipal?: number;
  debtInterestRate?: number;
  debtInterestModel?: DebtInterestModel;
  debtLenderType?: DebtLenderType;
  debtStartDate?: string;
  debtTermMonths?: number;
  debtRepaymentFrequency?: DebtRepaymentFrequency;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  userId: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: SupportedCurrency;
  originalAmount: number;
  fxRateToUgx?: number;
  occurredOn: string;
  categoryId: string;
  reconciliationState: ReconciliationState;
  source: TransactionSource;
  payee?: string;
  rawPayee?: string;
  note?: string;
  messageHash?: string;
  captureEnvelopeId?: string;
  captureReviewItemId?: string;
  parserLabel?: string;
  confidenceScore?: number;
  isRecurringCandidate?: boolean;
  matchedRuleId?: string;
  reviewedAt?: string;
  transferGroupId?: string;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  isDefault: boolean;
  createdAt: string;
};

export type Goal = {
  id: string;
  userId: string;
  name: string;
  goalType: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: number;
  linkedAccountId?: string;
  createdAt: string;
  updatedAt: string;
};

export type BudgetTarget = {
  id: string;
  userId: string;
  month: string;
  categoryId: string;
  targetAmount: number;
  rolloverAmount?: number;
  incomeTransactionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type InvestmentProfile = {
  id: string;
  userId: string;
  timeHorizonMonths: number;
  liquidityNeed: LiquidityNeed;
  riskComfort: RiskComfort;
  goalFocus: GoalType | "general_wealth";
  guidanceLevel: GuidanceLevel;
  createdAt: string;
  updatedAt: string;
};

export type ResourceLink = {
  id: string;
  title: string;
  sourceName: string;
  url: string;
  topic: string;
  isOfficial: boolean;
};

export type MonthlyInsight = {
  id: string;
  userId: string;
  title: string;
  body: string;
  priority: 1 | 2 | 3;
  month: string;
};

export type ImportBatch = {
  id: string;
  userId: string;
  sourceName: string;
  importedAt: string;
  rowCount: number;
};

export type CaptureEnvelope = {
  id: string;
  userId: string;
  source: CaptureEnvelopeSource;
  rawContent: string;
  contentHash: string;
  sourceTitle?: string;
  sourceApp?: string;
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CaptureFieldWarning = {
  field: CaptureConfidenceField;
  level: CaptureWarningLevel;
  message: string;
};

export type CaptureReviewSnapshot = {
  accountId: string;
  occurredOn: string;
  originalAmount: number;
  currency: SupportedCurrency;
  fxRateToUgx?: number;
  normalizedAmount: number;
  type: Exclude<TransactionType, "transfer">;
  categoryId: string;
  payee: string;
  note: string;
  parserLabel?: string;
  confidenceScore: number;
  issues: string[];
  fieldWarnings: CaptureFieldWarning[];
};

export type CaptureReviewItem = {
  id: string;
  userId: string;
  envelopeId: string;
  source: TransactionSource;
  accountId: string;
  occurredOn: string;
  originalAmount: number;
  currency: SupportedCurrency;
  fxRateToUgx?: number;
  normalizedAmount: number;
  type: Exclude<TransactionType, "transfer">;
  categoryId: string;
  payee: string;
  note: string;
  messageHash: string;
  parserLabel?: string;
  confidenceScore: number;
  status: CaptureReviewStatus;
  issues: string[];
  fieldWarnings: CaptureFieldWarning[];
  originalSnapshot: CaptureReviewSnapshot;
  duplicateTransactionId?: string;
  duplicateCaptureReviewItemId?: string;
  approvedTransactionId?: string;
  reviewedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CorrectionLog = {
  id: string;
  userId: string;
  reviewItemId: string;
  envelopeId: string;
  source: TransactionSource;
  parserLabel?: string;
  confidenceScore: number;
  originalSnapshot: CaptureReviewSnapshot;
  approvedSnapshot: CaptureReviewSnapshot;
  createdAt: string;
};

export type SyncProfile = {
  id: string;
  userId: string;
  mode: SyncMode;
  hostedSyncEnabled: boolean;
  postgresSyncUrl?: string;
  deviceId?: string;
  syncAuthToken?: string;
  lastSyncedAt?: string;
  lastPulledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SyncOutboxItem = {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  operation: SyncOutboxOperation;
  payload: string;
  status: SyncOutboxStatus;
  attempts: number;
  queuedAt: string;
  updatedAt: string;
  lastError?: string;
  conflictPayload?: string;
};

export type TransactionRule = {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  priority: number;
  senderPattern?: string;
  source?: TransactionSource;
  payeePattern?: string;
  keywordPattern?: string;
  amountPattern?: string;
  categoryId?: string;
  accountId?: string;
  effectPayee?: string;
  effectCategoryId?: string;
  effectAccountId?: string;
  effectTransactionType?: TransactionType;
  autoMarkReviewed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecurringObligationType =
  | "rent"
  | "school_fees"
  | "data_airtime"
  | "sacco_contribution"
  | "salary"
  | "loan_repayment";

export type RecurringCadence = "weekly" | "monthly" | "custom";

export type RecurringObligation = {
  id: string;
  userId: string;
  name: string;
  type: RecurringObligationType;
  categoryId: string;
  expectedAmount: number;
  cadence: RecurringCadence;
  dueDay?: number;
  dueDatePattern?: string;
  linkedAccountId?: string;
  payee?: string;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
};

export type MonthClose = {
  id: string;
  userId: string;
  period: string;
  state: "open" | "ready" | "closed";
  unresolvedTransactions: number;
  duplicateAlerts: number;
  missingCategoryCount: number;
  closedAt?: string;
  exportedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthSummary = {
  openingBalance: number;
  inflow: number;
  outflow: number;
  savings: number;
  allocatedSavings: number;
  transfers: number;
  movement: number;
  closingBalance: number;
  net: number;
  topCategories: {
    categoryId: string;
    categoryName: string;
    amount: number;
  }[];
};

export type GoalContributionPlan = {
  goalId: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  monthsRemaining: number;
  monthlyContribution: number;
  isBehindSchedule: boolean;
};

export type InvestmentGuidance = {
  recommendedProducts: string[];
  warnings: string[];
  rationale: string[];
  shouldPrioritizeEmergencyFund: boolean;
  shouldPrioritizeDebtRepayment: boolean;
};
