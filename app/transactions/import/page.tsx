import { redirect } from "next/navigation";

// Grouped by cadence: importing a statement is its own periodic job.
export default function TransactionsImportRedirect() {
  redirect("/import");
}
