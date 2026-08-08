import { splitCaptureMessages } from "@/lib/capture/normalizers";

/**
 * Sorting captured messages by who sent them.
 *
 * A Shortcut appends every message it is told to watch. The person decides in
 * Moat which senders they actually want read. That decision belongs here rather
 * than in Shortcuts, because changing it must not mean editing an automation.
 *
 * Nothing is discarded. An unrecognised message is separated, not dropped: it
 * may still be money, and this app never throws away a record on a guess.
 */

export type SenderMatch = {
  /** The catalog entry the message matched, or undefined when none did. */
  senderId?: string;
  message: string;
};

export type SenderPartition = {
  matched: SenderMatch[];
  unmatched: string[];
};

export type SenderMatcher = {
  id: string;
  /** Any of these appearing in the message marks it as from this sender. */
  matchTerms: string[];
};

function matchSender(message: string, matchers: SenderMatcher[]): string | undefined {
  const haystack = message.toLowerCase();
  return matchers.find((matcher) =>
    matcher.matchTerms.some((term) => haystack.includes(term.toLowerCase())),
  )?.id;
}

export function partitionMessagesBySender(
  input: string,
  matchers: SenderMatcher[],
): SenderPartition {
  const messages = splitCaptureMessages(input);
  const partition: SenderPartition = { matched: [], unmatched: [] };

  for (const message of messages) {
    const senderId = matchSender(message, matchers);
    if (senderId) {
      partition.matched.push({ senderId, message });
    } else {
      partition.unmatched.push(message);
    }
  }

  return partition;
}

/** The matched messages joined back into one blob for the parser. */
export function joinMessages(messages: string[]): string {
  return messages.join("\n\n");
}
