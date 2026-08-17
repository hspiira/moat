import { redirect } from "next/navigation";

// Grouped by cadence: a monthly job no longer sits under the daily ledger.
export default function TransactionsMonthCloseRedirect() {
  redirect("/month");
}
