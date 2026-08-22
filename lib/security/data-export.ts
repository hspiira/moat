import { clearRepositoryStorage } from "@/lib/repositories/admin";
import { repositories } from "@/lib/repositories/instance";
import type {
  Account,
  BudgetTarget,
  CaptureEnvelope,
  CaptureReviewItem,
  Category,
  CorrectionLog,
  Counterparty,
  Goal,
  ImportBatch,
  InvestmentProfile,
  Item,
  MonthClose,
  PlannedPurchase,
  Project,
  SyncVersion,
  RecurringObligation,
  SyncOutboxItem,
  SyncProfile,
  Transaction,
  TransactionLineItem,
  TransactionRule,
  UserProfile,
} from "@/lib/types";

export const EXPORT_SCHEMA_VERSION = 3;

export type FullExport = {
  exportedAt: string;
  schemaVersion: number;
  userProfile: UserProfile | null;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  budgets: BudgetTarget[];
  investmentProfiles: InvestmentProfile[];
  imports: ImportBatch[];
  syncProfiles: SyncProfile[];
  syncOutbox: SyncOutboxItem[];
  counterparties?: Counterparty[];
  transactionRules?: TransactionRule[];
  recurringObligations?: RecurringObligation[];
  monthCloses?: MonthClose[];
  items?: Item[];
  plannedPurchases?: PlannedPurchase[];
  projects?: Project[];
  syncVersions?: SyncVersion[];
  transactionLineItems?: TransactionLineItem[];
  captureEnvelopes?: CaptureEnvelope[];
  captureReviewItems?: CaptureReviewItem[];
  correctionLogs?: CorrectionLog[];
};

export async function collectFullExport(): Promise<FullExport> {
  const userProfile = await repositories.userProfile.get();
  const userId = userProfile?.id ?? "";
  const forUser = <T>(read: (id: string) => Promise<T[]>): Promise<T[]> =>
    userId ? read(userId) : Promise.resolve([]);

  const [
    accounts,
    transactions,
    categories,
    goals,
    budgets,
    imports,
    syncOutbox,
    counterparties,
    transactionRules,
    recurringObligations,
    monthCloses,
    items,
    plannedPurchases,
    projects,
    syncVersions,
    transactionLineItems,
    captureEnvelopes,
    captureReviewItems,
    correctionLogs,
  ] = await Promise.all([
    forUser((id) => repositories.accounts.listByUser(id)),
    forUser((id) => repositories.transactions.listByUser(id)),
    forUser((id) => repositories.categories.listByUser(id)),
    forUser((id) => repositories.goals.listByUser(id)),
    forUser((id) => repositories.budgets.listByUser(id)),
    forUser((id) => repositories.imports.listByUser(id)),
    forUser((id) => repositories.syncOutbox.listByUser(id)),
    forUser((id) => repositories.counterparties.listByUser(id)),
    forUser((id) => repositories.transactionRules.listByUser(id)),
    forUser((id) => repositories.recurringObligations.listByUser(id)),
    forUser((id) => repositories.monthCloses.listByUser(id)),
    forUser((id) => repositories.items.listByUser(id)),
    forUser((id) => repositories.plannedPurchases.listByUser(id)),
    forUser((id) => repositories.projects.listByUser(id)),
    forUser((id) => repositories.syncVersions.listByUser(id)),
    forUser((id) => repositories.transactionLineItems.listByUser(id)),
    forUser((id) => repositories.captureEnvelopes.listByUser(id)),
    forUser((id) => repositories.captureReviewItems.listByUser(id)),
    forUser((id) => repositories.correctionLogs.listByUser(id)),
  ]);

  const [syncProfile, investmentProfile] = await Promise.all([
    userId ? repositories.syncProfiles.getByUser(userId) : Promise.resolve(null),
    userId ? repositories.investmentProfiles.getByUser(userId) : Promise.resolve(null),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: EXPORT_SCHEMA_VERSION,
    userProfile,
    accounts,
    transactions,
    categories,
    goals,
    budgets,
    investmentProfiles: investmentProfile ? [investmentProfile] : [],
    imports,
    syncProfiles: syncProfile ? [syncProfile] : [],
    syncOutbox,
    counterparties,
    transactionRules,
    recurringObligations,
    monthCloses,
    items,
    plannedPurchases,
    projects,
    syncVersions,
    transactionLineItems,
    captureEnvelopes,
    captureReviewItems,
    correctionLogs,
  };
}

export async function restoreFullExport(data: FullExport): Promise<void> {
  if (data.userProfile) {
    await repositories.userProfile.replaceAll(data.userProfile);
  }

  await Promise.all([
    ...data.accounts.map((r) => repositories.accounts.upsert(r)),
    ...data.transactions.map((r) => repositories.transactions.upsert(r)),
    ...data.categories.map((r) => repositories.categories.upsert(r)),
    ...data.goals.map((r) => repositories.goals.upsert(r)),
    ...data.budgets.map((r) => repositories.budgets.upsert(r)),
    ...data.imports.map((r) => repositories.imports.upsert(r)),
    ...data.syncProfiles.map((r) => repositories.syncProfiles.save(r)),
    ...data.syncOutbox.map((r) => repositories.syncOutbox.upsert(r)),
    ...(data.counterparties ?? []).map((r) => repositories.counterparties.upsert(r)),
    ...(data.transactionRules ?? []).map((r) => repositories.transactionRules.upsert(r)),
    ...(data.recurringObligations ?? []).map((r) =>
      repositories.recurringObligations.upsert(r),
    ),
    ...(data.monthCloses ?? []).map((r) => repositories.monthCloses.upsert(r)),
    ...(data.items ?? []).map((r) => repositories.items.upsert(r)),
    ...(data.plannedPurchases ?? []).map((r) => repositories.plannedPurchases.upsert(r)),
    ...(data.projects ?? []).map((r) => repositories.projects.upsert(r)),
    ...(data.syncVersions ?? []).map((r) => repositories.syncVersions.upsert(r)),
    ...(data.transactionLineItems ?? []).map((r) =>
      repositories.transactionLineItems.upsert(r),
    ),
    ...(data.captureEnvelopes ?? []).map((r) => repositories.captureEnvelopes.upsert(r)),
    ...(data.captureReviewItems ?? []).map((r) => repositories.captureReviewItems.upsert(r)),
    ...(data.correctionLogs ?? []).map((r) => repositories.correctionLogs.upsert(r)),
    ...(data.investmentProfiles.length > 0
      ? [repositories.investmentProfiles.save(data.investmentProfiles[0])]
      : []),
  ]);
}

export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export async function deleteAllUserData(): Promise<void> {
  return clearRepositoryStorage();
}
