import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("@/lib/local-save", () => ({
  announceLocalSave: vi.fn(),
}));

import type { RepositoryBundle } from "@/lib/repositories/types";
import type { CaptureEnvelope, CaptureReviewItem, Category, Transaction, TransactionRule } from "@/lib/types";

import {
  ingestNativeCapturePayload,
  persistReviewedCaptureCandidates,
} from "@/lib/capture/persistence";

function createRepositories() {
  const captureEnvelopes: CaptureEnvelope[] = [];
  const captureReviewItems: CaptureReviewItem[] = [];
  const categories: Category[] = [
    {
      id: "category:income",
      userId: "user:1",
      name: "Income",
      kind: "income",
      isDefault: true,
      createdAt: "2026-04-07T00:00:00.000Z",
    },
    {
      id: "category:expense",
      userId: "user:1",
      name: "Expense",
      kind: "expense",
      isDefault: true,
      createdAt: "2026-04-07T00:00:00.000Z",
    },
    {
      id: "category:savings",
      userId: "user:1",
      name: "Savings",
      kind: "savings",
      isDefault: true,
      createdAt: "2026-04-07T00:00:00.000Z",
    },
  ];
  const transactions: Transaction[] = [];
  const transactionRules: TransactionRule[] = [];

  const repositories = {
    userProfile: {} as RepositoryBundle["userProfile"],
    accounts: {} as RepositoryBundle["accounts"],
    transactions: {
      listByUser: vi.fn(async () => transactions),
    } as unknown as RepositoryBundle["transactions"],
    captureEnvelopes: {
      listByUser: vi.fn(async () => captureEnvelopes),
      upsert: vi.fn(async (envelope: CaptureEnvelope) => {
        captureEnvelopes.push(envelope);
        return envelope;
      }),
    } as unknown as RepositoryBundle["captureEnvelopes"],
    captureReviewItems: {
      listByUser: vi.fn(async () => captureReviewItems),
      // Replaces by id, as an upsert does. Pushing regardless made an updated
      // row look like a second row, which is the very thing being tested.
      upsert: vi.fn(async (item: CaptureReviewItem) => {
        const at = captureReviewItems.findIndex((entry) => entry.id === item.id);
        if (at === -1) captureReviewItems.push(item);
        else captureReviewItems[at] = item;
        return item;
      }),
    } as unknown as RepositoryBundle["captureReviewItems"],
    correctionLogs: {} as RepositoryBundle["correctionLogs"],
    transactionRules: {
      listByUser: vi.fn(async () => transactionRules),
    } as unknown as RepositoryBundle["transactionRules"],
    recurringObligations: {} as RepositoryBundle["recurringObligations"],
    monthCloses: {} as RepositoryBundle["monthCloses"],
    categories: {
      listByUser: vi.fn(async () => categories),
    } as unknown as RepositoryBundle["categories"],
    goals: {} as RepositoryBundle["goals"],
    budgets: {} as RepositoryBundle["budgets"],
    investmentProfiles: {} as RepositoryBundle["investmentProfiles"],
    imports: {} as RepositoryBundle["imports"],
    resources: {} as RepositoryBundle["resources"],
    syncProfiles: {} as RepositoryBundle["syncProfiles"],
    syncOutbox: {} as RepositoryBundle["syncOutbox"],
  } as RepositoryBundle;

  return { repositories, captureEnvelopes, captureReviewItems };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("capture persistence", () => {
  it("persists native shared text into envelopes and review items", async () => {
    const { repositories, captureEnvelopes, captureReviewItems } = createRepositories();

    const result = await ingestNativeCapturePayload({
      repositories,
      userId: "user:1",
      accountId: "account:1",
      payload: {
        channel: "shared_text",
        source: "shared_text",
        rawContent: "Received UGX 50,000 from Sender on 06-04-2026",
        occurredAt: "2026-04-07T10:00:00.000Z",
      },
    });

    expect(result.persistedEnvelopeCount).toBe(1);
    expect(result.persistedReviewCount).toBe(1);
    expect(captureEnvelopes[0]).toMatchObject({
      source: "shared_text",
    });
    expect(captureReviewItems[0]).toMatchObject({
      source: "sms",
      accountId: "account:1",
    });
  });

  it("skips duplicate native payloads on retry", async () => {
    const { repositories } = createRepositories();
    const payload = {
      channel: "shared_text" as const,
      source: "shared_text" as const,
      rawContent: "Received UGX 50,000 from Sender on 06-04-2026",
      occurredAt: "2026-04-07T10:00:00.000Z",
    };

    await ingestNativeCapturePayload({
      repositories,
      userId: "user:1",
      accountId: "account:1",
      payload,
    });
    const retried = await ingestNativeCapturePayload({
      repositories,
      userId: "user:1",
      accountId: "account:1",
      payload,
    });

    expect(retried).toMatchObject({
      persistedEnvelopeCount: 0,
      persistedReviewCount: 0,
    });
  });

  it("keeps manual text capture persistence working through the shared service", async () => {
    const { repositories, captureEnvelopes, captureReviewItems } = createRepositories();

    const result = await persistReviewedCaptureCandidates({
      repositories,
      userId: "user:1",
      source: "pasted_text",
      candidates: [
        {
          id: "capture:1",
          rawText: "Paid UGX 15,000 to Grocery on 07-04-2026",
          occurredOn: "2026-04-07",
          originalAmount: 15000,
          currency: "UGX",
          normalizedAmount: 15000,
          type: "expense",
          categoryId: "category:expense",
          accountId: "account:1",
          payee: "Grocery",
          note: "Paid UGX 15,000 to Grocery on 07-04-2026",
          source: "manual",
          messageHash: "hash:1",
          confidence: 0.8,
          fieldWarnings: [],
          duplicate: false,
          issues: [],
        },
      ],
    });

    expect(result.persistedEnvelopeCount).toBe(1);
    expect(captureEnvelopes[0]).toMatchObject({
      source: "pasted_text",
    });
    expect(captureReviewItems[0]).toMatchObject({
      payee: "Grocery",
    });
  });

  /* Each shortcut run stamps its own moment, so the same message handed over
     twice is not the exact retry the envelope check catches. Two rows for it are
     two chances to approve the same money twice. */
  it("counts a repeat onto the row already waiting", async () => {
    const { repositories, captureReviewItems } = createRepositories();
    const message = "Paid UGX 15,000 to Grocery on 07-04-2026";

    const first = await ingestNativeCapturePayload({
      repositories,
      userId: "user:1",
      accountId: "account:1",
      payload: {
        channel: "shared_text",
        source: "shared_text",
        rawContent: message,
        occurredAt: "2026-04-07T10:00:00.000Z",
      },
    });
    const second = await ingestNativeCapturePayload({
      repositories,
      userId: "user:1",
      accountId: "account:1",
      payload: {
        channel: "shared_text",
        source: "shared_text",
        rawContent: message,
        occurredAt: "2026-04-07T11:30:00.000Z",
      },
    });

    expect(first.persistedReviewCount).toBe(1);
    expect(second.persistedReviewCount).toBe(0);
    expect(second.countedAgainstExistingCount).toBe(1);
    expect(captureReviewItems).toHaveLength(1);
    expect(captureReviewItems[0].occurrenceCount).toBe(2);
    expect(captureReviewItems[0].occurrenceCapturedAt).toHaveLength(2);
  });

  /* Once the first copy has been settled, the message arriving again is news,
     and the check against the ledger is what speaks to it from then on. */
  it("adds the row again once the first copy has been settled", async () => {
    const { repositories, captureReviewItems } = createRepositories();
    const message = "Paid UGX 15,000 to Grocery on 07-04-2026";

    await ingestNativeCapturePayload({
      repositories,
      userId: "user:1",
      accountId: "account:1",
      payload: {
        channel: "shared_text",
        source: "shared_text",
        rawContent: message,
        occurredAt: "2026-04-07T10:00:00.000Z",
      },
    });
    captureReviewItems[0].status = "rejected";

    const second = await ingestNativeCapturePayload({
      repositories,
      userId: "user:1",
      accountId: "account:1",
      payload: {
        channel: "shared_text",
        source: "shared_text",
        rawContent: message,
        occurredAt: "2026-04-07T11:30:00.000Z",
      },
    });

    expect(second.persistedReviewCount).toBe(1);
    expect(captureReviewItems).toHaveLength(2);
  });

  it("keeps two genuinely different messages apart", async () => {
    const { repositories, captureReviewItems } = createRepositories();

    for (const rawContent of [
      "Paid UGX 15,000 to Grocery on 07-04-2026",
      "Paid UGX 4,000 to Fuel on 07-04-2026",
    ]) {
      await ingestNativeCapturePayload({
        repositories,
        userId: "user:1",
        accountId: "account:1",
        payload: { channel: "shared_text", source: "shared_text", rawContent },
      });
    }

    expect(captureReviewItems).toHaveLength(2);
  });
});
