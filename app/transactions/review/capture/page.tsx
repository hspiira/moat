import { redirect } from "next/navigation";

export default function TransactionsCaptureReviewRedirect() {
  redirect("/inbox");
}
