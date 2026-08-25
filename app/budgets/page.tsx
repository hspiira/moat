import { redirect } from "next/navigation";

// Budgets and recurring bills are two halves of one month's plan.
export default function BudgetsPage() {
  redirect("/plan");
}
