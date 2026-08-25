import { TODAY, USER_ID } from "./ledger";

const day = (back: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00.000Z`) - back * 86_400_000).toISOString().slice(0, 10);
const stamp = (back: number) => `${day(back)}T09:00:00.000Z`;

const ITEM_SPECS = [
  ["it-sugar", "Sugar", "kg"],
  ["it-rice", "Rice", "kg"],
  ["it-soap", "Soap", "bar"],
  ["it-gas", "Gas refill", "cylinder"],
  ["it-milk", "Milk", "litre"],
  ["it-sofa", "Sofa set", undefined],
] as const;

export const SHOPPING_ITEMS = ITEM_SPECS.map(([id, name, unit]) => ({
  id,
  userId: USER_ID,
  name,
  normalizedName: name.toLowerCase(),
  unit,
  isArchived: false,
  createdAt: stamp(90),
  updatedAt: stamp(90),
}));

export const SHOPPING_TRANSACTIONS = [
  { id: "shop-tx-1", occurredOn: day(60), amount: -34_000, payee: "Nakasero Market" },
  { id: "shop-tx-2", occurredOn: day(9), amount: -41_000, payee: "Nakasero Market" },
  { id: "shop-tx-3", occurredOn: day(20), amount: -200_000, payee: "Furniture Plus" },
].map((entry) => ({
  ...entry,
  userId: USER_ID,
  accountId: "e2e-account-momo",
  type: "expense" as const,
  currency: "UGX" as const,
  originalAmount: Math.abs(entry.amount),
  source: "manual" as const,
  createdAt: `${entry.occurredOn}T09:00:00.000Z`,
  updatedAt: `${entry.occurredOn}T09:00:00.000Z`,
}));

export const SHOPPING_LINE_ITEMS = [
  ["li-1", "shop-tx-1", "it-sugar", 2, 4_000, "pp-sugar-old"],
  ["li-2", "shop-tx-1", "it-rice", 3, 3_400, "pp-rice-old"],
  ["li-3", "shop-tx-1", "it-milk", 4, 2_000, "pp-milk-old"],
  ["li-4", "shop-tx-2", "it-sugar", 2, 4_900, "pp-sugar-new"],
  ["li-5", "shop-tx-2", "it-rice", 3, 3_200, "pp-rice-new"],
  ["li-6", "shop-tx-2", "it-milk", 4, 2_060, "pp-milk-new"],
  ["li-7", "shop-tx-3", "it-sofa", 1, 200_000, "pp-sofa"],
].map(([id, transactionId, itemId, quantity, unitPrice, plannedPurchaseId]) => ({
  id: id as string,
  userId: USER_ID,
  transactionId: transactionId as string,
  itemId: itemId as string,
  label: String(itemId).replace("it-", ""),
  quantity: quantity as number,
  unitPrice: unitPrice as number,
  plannedPurchaseId: plannedPurchaseId as string,
  createdAt: stamp(60),
  updatedAt: stamp(60),
}));

function purchase(over: Record<string, unknown>) {
  return {
    userId: USER_ID,
    status: "planned",
    createdAt: stamp(30),
    updatedAt: stamp(30),
    ...over,
  };
}

export const SHOPPING_PURCHASES = [
  purchase({ id: "pp-1", itemId: "it-sugar", quantity: 2, estimatedUnitPrice: 4_900, neededBy: day(3) }),
  purchase({ id: "pp-2", itemId: "it-rice", quantity: 3, estimatedUnitPrice: 3_200, neededBy: day(-2) }),
  purchase({ id: "pp-3", itemId: "it-soap", quantity: 4, estimatedUnitPrice: 1_500, neededBy: day(-9) }),
  purchase({ id: "pp-4", itemId: "it-gas", quantity: 1, estimatedUnitPrice: 120_000 }),
  purchase({ id: "pp-5", itemId: "it-milk", quantity: 4, estimatedUnitPrice: 2_060, neededBy: day(-1) }),
  purchase({
    id: "pp-sofa",
    itemId: "it-sofa",
    quantity: 1,
    expectedTotal: 500_000,
    neededBy: day(-30),
  }),
  purchase({ id: "pp-dropped", itemId: "it-soap", status: "dropped", updatedAt: stamp(5) }),
  // Bought, across two trips, so prices per unit have something to compare.
  ...["sugar", "rice", "milk"].flatMap((name, index) => [
    purchase({
      id: `pp-${name}-old`,
      itemId: `it-${name}`,
      status: "purchased",
      quantity: [2, 3, 4][index],
      estimatedUnitPrice: [4_000, 3_500, 2_000][index],
      linkedTransactionId: "shop-tx-1",
      linkedLineItemId: `li-${index + 1}`,
      updatedAt: stamp(60),
    }),
    purchase({
      id: `pp-${name}-new`,
      itemId: `it-${name}`,
      status: "purchased",
      quantity: [2, 3, 4][index],
      estimatedUnitPrice: [4_500, 3_500, 2_000][index],
      linkedTransactionId: "shop-tx-2",
      linkedLineItemId: `li-${index + 4}`,
      updatedAt: stamp(9),
    }),
  ]),
];
