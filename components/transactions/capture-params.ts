import type { CaptureIntent } from "./capture-intent";

export type CaptureParams = {
  intent: CaptureIntent;
  /** Text handed over by the OS share sheet. */
  sharedInput: string;
  prefill: {
    type: string | null;
    accountId: string | null;
    amount: string | null;
    payee: string | null;
  };
  hasPrefill: boolean;
};

const INTENTS = ["expense", "income", "transfer", "import", "text"] as const;

/** Reads the query string the launcher shortcuts and share target arrive with. */
export function readCaptureParams(params: URLSearchParams): CaptureParams {
  const capture = params.get("capture");
  const sharedInput = [params.get("title"), params.get("text"), params.get("url")]
    .filter(Boolean)
    .join("\n");

  const prefill = {
    type: params.get("type"),
    accountId: params.get("accountId"),
    amount: params.get("amount"),
    payee: params.get("payee"),
  };

  return {
    intent: INTENTS.includes(capture as (typeof INTENTS)[number])
      ? (capture as CaptureIntent)
      : sharedInput
        ? "text"
        : null,
    sharedInput,
    prefill,
    hasPrefill: Boolean(
      capture || sharedInput || Object.values(prefill).some((value) => value !== null),
    ),
  };
}
