import { redirect } from "next/navigation";

// Budgets and recurring bills are two halves of one month's plan, so the old
// route still works and arrives with its own half already selected.
export default function BudgetsPage() {
  redirect("/plan?section=budgets");
}
