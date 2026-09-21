import { redirect } from "next/navigation";

export default function RecurringPage() {
  redirect("/plan?section=bills");
}
