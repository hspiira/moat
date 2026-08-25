import { matchByName } from "@/lib/capture/name-match";
import type { Account } from "@/lib/types";

export type CaptureAccountChoice = {
  accountId: string;
  /** False when nothing in the message named an account and the first was used. */
  matched: boolean;
};

/**
 * The account a captured message belongs to.
 *
 * This used to be whichever account came back first, so money from every
 * provider landed on one of them. The sender is what usually says: a message
 * from MTNMobMoney belongs to the MTN account, not to whichever account was
 * created first.
 *
 * A sender mapped to an account in settings settles it outright. Nothing spells
 * "MTNMobMoney" and "MTN MoMo" close enough for one to be read from the other,
 * so the mapping is what makes those senders land right.
 *
 * When nothing names an account the first is still used, because a capture with
 * no account cannot be reviewed at all, but the caller is told it was a fallback
 * rather than a reading.
 */
export function chooseCaptureAccount(params: {
  accounts: Account[];
  sender?: string;
  text?: string;
  /** The account chosen for this sender in settings, which settles it. */
  mappedAccountId?: string;
}): CaptureAccountChoice | null {
  if (params.accounts.length === 0) return null;

  const mapped = params.accounts.find((account) => account.id === params.mappedAccountId);
  if (mapped) {
    return { accountId: mapped.id, matched: true };
  }

  const named = params.accounts.map((account) => ({
    id: account.id,
    names: [account.name, account.institutionName].filter(
      (name): name is string => Boolean(name),
    ),
  }));

  const match = matchByName(named, [params.sender, params.text]);

  return match
    ? { accountId: match.id, matched: true }
    : { accountId: params.accounts[0].id, matched: false };
}
