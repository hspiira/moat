import { redirect } from "next/navigation";

// Grouped by cadence: the capture inbox is its own destination.
export default function TransactionsReviewRedirect() {
  redirect("/inbox");
}
