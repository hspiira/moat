import { deriveSeededId } from "@/lib/ids";
import { isTransferTransaction } from "@/lib/domain/transfers";
import type {
  Account,
  Counterparty,
  CounterpartyKind,
  Transaction,
  TransactionType,
} from "@/lib/types";

const BALANCE_EPSILON = 0.01;
const MILLISECONDS_PER_DAY = 86_400_000;

export type PartyStatus = "outstanding" | "settled" | "cancelled" | "overpaid";

export type PartyLedgerConfig = {
  poolAccountSlug: string;
  poolAccountName: string;
  poolAccountType: Account["type"];
  sign: 1 | -1;
  unnamedLabel: string;
  counterpartyKind: Exclude<CounterpartyKind, "both">;
  cancelType: TransactionType;
  ownsAccount: (account: Account) => boolean;
};

export type PartyLedgerEntry = {
  partyKey: string;
  partyName: string;
  counterpartyId?: string;
  accountId?: string;
  amountAdvanced: number;
  amountRepaid: number;
  amountCancelled: number;
  outstanding: number;
  advancedOn: string | null;
  lastRepaymentOn: string | null;
  expectedRepaymentDate?: string;
  isOverdue: boolean;
  status: PartyStatus;
  daysSinceLastActivity: number;
};

export type PartyPortfolio = {
  totalAdvanced: number;
  totalRepaid: number;
  totalCancelled: number;
  totalOutstanding: number;
  parties: PartyLedgerEntry[];
};

export function poolAccountIdFor(config: PartyLedgerConfig, userId: string): string {
  return deriveSeededId(userId, config.poolAccountSlug);
}

export function isPoolAccount(config: PartyLedgerConfig, account: Account): boolean {
  return account.id === poolAccountIdFor(config, account.userId);
}

export function buildPoolAccount(
  config: PartyLedgerConfig,
  userId: string,
  timestamp: string,
): Account {
  return {
    id: poolAccountIdFor(config, userId),
    userId,
    name: config.poolAccountName,
    type: config.poolAccountType,
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function toUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function isoDateToUtcDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function deriveStatus(outstanding: number, amountCancelled: number): PartyStatus {
  if (outstanding < -BALANCE_EPSILON) {
    return "overpaid";
  }
  if (Math.abs(outstanding) <= BALANCE_EPSILON) {
    return amountCancelled > 0 ? "cancelled" : "settled";
  }
  return "outstanding";
}

type Bucket = {
  partyKey: string;
  partyName: string;
  accountId?: string;
  counterpartyId?: string;
  openingBalance: number;
  transactions: Transaction[];
};

function bucketFor(
  config: PartyLedgerConfig,
  account: Account,
  transaction: Transaction,
  counterparties: Map<string, Counterparty>,
): { key: string; name: string; counterpartyId?: string } {
  if (!isPoolAccount(config, account)) {
    return { key: `account:${account.id}`, name: account.name };
  }

  const counterparty = transaction.counterpartyId
    ? counterparties.get(transaction.counterpartyId)
    : undefined;
  if (counterparty) {
    return {
      key: `counterparty:${counterparty.id}`,
      name: counterparty.name,
      counterpartyId: counterparty.id,
    };
  }

  const payee = transaction.payee?.trim();
  if (!payee) {
    return { key: "payee:", name: config.unnamedLabel };
  }

  return { key: `payee:${payee.toLowerCase()}`, name: payee };
}

function summarise(config: PartyLedgerConfig, bucket: Bucket, asOf: Date): PartyLedgerEntry {
  let amountAdvanced = Math.max(0, bucket.openingBalance);
  let amountRepaid = 0;
  let amountCancelled = 0;
  let advancedOn: string | null = null;
  let lastRepaymentOn: string | null = null;
  let lastActivityOn: string | null = null;
  let expectedRepaymentDate: string | undefined;

  for (const transaction of bucket.transactions) {
    const magnitude = Math.abs(transaction.amount);
    const signed = transaction.amount * config.sign;

    if (transaction.type === config.cancelType) {
      amountCancelled += magnitude;
    } else if (signed > 0) {
      amountAdvanced += magnitude;
      if (advancedOn === null || transaction.occurredOn < advancedOn) {
        advancedOn = transaction.occurredOn;
      }
      const due = transaction.expectedRepaymentDate;
      if (due && (expectedRepaymentDate === undefined || due < expectedRepaymentDate)) {
        expectedRepaymentDate = due;
      }
    } else {
      amountRepaid += magnitude;
      if (lastRepaymentOn === null || transaction.occurredOn > lastRepaymentOn) {
        lastRepaymentOn = transaction.occurredOn;
      }
    }

    if (lastActivityOn === null || transaction.occurredOn > lastActivityOn) {
      lastActivityOn = transaction.occurredOn;
    }
  }

  const outstanding = amountAdvanced - amountRepaid - amountCancelled;
  const status = deriveStatus(outstanding, amountCancelled);

  return {
    partyKey: bucket.partyKey,
    partyName: bucket.partyName,
    counterpartyId: bucket.counterpartyId,
    accountId: bucket.accountId,
    amountAdvanced,
    amountRepaid,
    amountCancelled,
    outstanding,
    advancedOn,
    lastRepaymentOn,
    expectedRepaymentDate,
    isOverdue:
      status === "outstanding" &&
      expectedRepaymentDate !== undefined &&
      toUtcDay(asOf) > isoDateToUtcDay(expectedRepaymentDate),
    status,
    daysSinceLastActivity:
      lastActivityOn === null
        ? 0
        : Math.max(
            0,
            Math.floor((toUtcDay(asOf) - isoDateToUtcDay(lastActivityOn)) / MILLISECONDS_PER_DAY),
          ),
  };
}

export function buildPartyPortfolio(
  config: PartyLedgerConfig,
  accounts: Account[],
  transactions: Transaction[],
  asOf: Date,
  counterparties: Counterparty[] = [],
): PartyPortfolio {
  const byId = new Map(counterparties.map((entry) => [entry.id, entry]));
  const owned = new Map(
    accounts
      .filter((account) => config.ownsAccount(account) && !account.isArchived)
      .map((account) => [account.id, account]),
  );

  const buckets = new Map<string, Bucket>();

  if ([...owned.values()].some((account) => isPoolAccount(config, account))) {
    for (const counterparty of counterparties) {
      if (!counterparty.openingBalance || counterparty.isArchived) {
        continue;
      }
      buckets.set(`counterparty:${counterparty.id}`, {
        partyKey: `counterparty:${counterparty.id}`,
        partyName: counterparty.name,
        counterpartyId: counterparty.id,
        openingBalance: counterparty.openingBalance,
        transactions: [],
      });
    }
  }

  for (const account of owned.values()) {
    const opening = account.openingBalance * config.sign;
    if (isPoolAccount(config, account) || opening <= 0) {
      continue;
    }
    buckets.set(`account:${account.id}`, {
      partyKey: `account:${account.id}`,
      partyName: account.name,
      accountId: account.id,
      openingBalance: opening,
      transactions: [],
    });
  }

  for (const transaction of transactions) {
    const account = owned.get(transaction.accountId);
    if (!account) {
      continue;
    }
    if (!isTransferTransaction(transaction) && transaction.type !== config.cancelType) {
      continue;
    }

    const { key, name, counterpartyId } = bucketFor(config, account, transaction, byId);
    const existing = buckets.get(key);

    if (existing) {
      existing.transactions.push(transaction);
      continue;
    }

    buckets.set(key, {
      partyKey: key,
      partyName: name,
      counterpartyId,
      accountId: isPoolAccount(config, account) ? undefined : account.id,
      openingBalance: isPoolAccount(config, account)
        ? 0
        : account.openingBalance * config.sign,
      transactions: [transaction],
    });
  }

  const parties = [...buckets.values()]
    .map((bucket) => summarise(config, bucket, asOf))
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) {
        return left.isOverdue ? -1 : 1;
      }
      if (left.outstanding !== right.outstanding) {
        return right.outstanding - left.outstanding;
      }
      return left.partyName.localeCompare(right.partyName);
    });

  return {
    totalAdvanced: parties.reduce((total, party) => total + party.amountAdvanced, 0),
    totalRepaid: parties.reduce((total, party) => total + party.amountRepaid, 0),
    totalCancelled: parties.reduce((total, party) => total + party.amountCancelled, 0),
    totalOutstanding: parties.reduce((total, party) => total + party.outstanding, 0),
    parties,
  };
}
