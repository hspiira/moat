import { redirect } from "next/navigation";

// Bringing transactions in is one job with three ways of doing it, so the
// statement upload lives with the other two rather than as its own destination.
export default function ImportPage() {
  redirect("/transactions/capture?capture=csv");
}
