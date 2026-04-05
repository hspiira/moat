export type LocalSaveDetail = {
  entity: "accounts" | "transactions" | "goals" | "investment_profile" | "onboarding";
  savedAt: string;
  message: string;
};

const LOCAL_SAVE_EVENT = "moat:local-save";

export function announceLocalSave(detail: LocalSaveDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<LocalSaveDetail>(LOCAL_SAVE_EVENT, { detail }));
}

export function getLocalSaveEventName() {
  return LOCAL_SAVE_EVENT;
}
