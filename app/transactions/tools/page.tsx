import { redirect } from "next/navigation";

// Grouped by cadence: rules are set once, so they live in settings.
export default function TransactionsToolsRedirect() {
  redirect("/settings/rules");
}
