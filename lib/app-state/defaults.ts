import type { AccountType, Category, GoalType, ResourceLink } from "@/lib/types";
import { categorySlug, feesCategoryId, seededCategoryId } from "@/lib/domain/seeded-ids";

const DEFAULT_DATE = "2026-01-01T00:00:00.000Z";

type DefaultCategorySeed = {
  name: string;
  kind: Category["kind"];
};

const defaultCategorySeeds: DefaultCategorySeed[] = [
  { name: "Salary", kind: "income" },
  { name: "Side income", kind: "income" },
  { name: "Rent", kind: "expense" },
  { name: "Food", kind: "expense" },
  { name: "Transport / boda", kind: "expense" },
  { name: "Airtime / data", kind: "expense" },
  { name: "Utilities", kind: "expense" },
  { name: "Fees & charges", kind: "expense" },
  { name: "Family support", kind: "expense" },
  { name: "School fees", kind: "expense" },
  { name: "Health", kind: "expense" },
  { name: "Church / giving", kind: "expense" },
  { name: "Tips", kind: "expense" },
  { name: "Savings", kind: "savings" },
  { name: "Investments", kind: "savings" },
  { name: "Transfers", kind: "transfer" },
  { name: "Lending", kind: "lending" },
  { name: "Debt repayment", kind: "debt_repayment" },
  { name: "Loan interest", kind: "expense" },
  { name: "Money written off", kind: "expense" },
  { name: "Debt forgiven", kind: "income" },
];

export const defaultAccountTypes: AccountType[] = [
  "cash",
  "mobile_money",
  "bank",
  "sacco",
  "investment",
  "debt",
  "receivable",
];

export const defaultGoalTypes: GoalType[] = [
  "emergency_fund",
  "rent_buffer",
  "school_fees",
  "land_savings",
  "business_capital",
  "education",
  "house_construction",
];

export {
  feesCategoryId,
  writeOffCategoryId,
  loanInterestCategoryId,
  debtRepaymentCategoryId,
} from "@/lib/domain/seeded-ids";

export function buildFeesCategory(userId: string): Category {
  return {
    id: feesCategoryId(userId),
    userId,
    name: "Fees & charges",
    kind: "expense",
    isDefault: true,
    createdAt: DEFAULT_DATE,
  };
}

export function ensureFeesCategory(
  stored: Category[],
  userId: string,
): Category | null {
  const wanted = buildFeesCategory(userId);
  const slug = categorySlug(wanted.name);
  const exists = stored.some((category) => category.id === wanted.id || category.id === slug);
  return exists ? null : wanted;
}

export function buildDefaultCategories(userId: string): Category[] {
  return defaultCategorySeeds.map((seed) => ({
    id: seededCategoryId(userId, seed.name),
    userId,
    name: seed.name,
    kind: seed.kind,
    isDefault: true,
    createdAt: DEFAULT_DATE,
  }));
}

export function reconcileDefaultCategories(
  stored: Category[],
  userId: string,
): Category[] {
  const byId = new Map(stored.map((category) => [category.id, category]));

  return buildDefaultCategories(userId).flatMap((seed) => {
    const existing = byId.get(seed.id) ?? byId.get(categorySlug(seed.name));

    if (!existing) {
      return [seed];
    }
    if (!existing.isDefault || existing.kind === seed.kind) {
      return [];
    }

    return [{ ...existing, kind: seed.kind }];
  });
}

export const defaultResourceLinks: ResourceLink[] = [
  {
    id: "resource:finscope-2023",
    title: "FinScope Uganda 2023 survey findings",
    sourceName: "FSD Uganda",
    url: "https://fsduganda.or.ug/wp-content/uploads/2024/04/FinScope-Uganda-2023-Findings-Summary.pdf",
    topic: "money-behaviour",
    isOfficial: true,
  },
  {
    id: "resource:ubos-labour",
    title: "Uganda labour statistics and household context",
    sourceName: "UBOS",
    url: "https://www.ubos.org/labour/",
    topic: "money-behaviour",
    isOfficial: true,
  },
  {
    id: "resource:bills-and-bonds",
    title: "Bank of Uganda bills and bonds calendar",
    sourceName: "Bank of Uganda",
    url: "https://bou.or.ug/bouwebsite/FinancialMarkets/billsandbonds.html",
    topic: "regulated-investing",
    isOfficial: true,
  },
  {
    id: "resource:cma",
    title: "Capital Markets Authority Uganda",
    sourceName: "Capital Markets Authority Uganda",
    url: "https://cmauganda.co.ug/",
    topic: "regulated-investing",
    isOfficial: true,
  },
  {
    id: "resource:use",
    title: "Uganda Securities Exchange",
    sourceName: "Uganda Securities Exchange",
    url: "https://use.or.ug/",
    topic: "regulated-investing",
    isOfficial: true,
  },
  {
    id: "resource:urbra",
    title: "Uganda Retirement Benefits Regulatory Authority",
    sourceName: "URBRA",
    url: "https://urbra.go.ug/",
    topic: "regulated-investing",
    isOfficial: true,
  },
  {
    id: "resource:umra",
    title: "Uganda Microfinance Regulatory Authority",
    sourceName: "UMRA",
    url: "https://umra.go.ug/",
    topic: "institution-verification",
    isOfficial: true,
  },
  {
    id: "resource:cma-investor-education",
    title: "CMA investor education resources",
    sourceName: "Capital Markets Authority Uganda",
    url: "https://cmauganda.co.ug/",
    topic: "institution-verification",
    isOfficial: true,
  },
];
