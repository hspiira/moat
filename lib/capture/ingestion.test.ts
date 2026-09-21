import { describe, expect, it } from "vitest";

import {
  createEnvelopeForSource,
  createEnvelopeFromNativePayload,
  deriveTransactionSourceFromEnvelopeSource,
} from "./ingestion";

const base = {
  userId: "user:1",
  rawContent: "Paid UGX 5,000 to Grocery",
  capturedAt: "2026-04-07T10:00:00.000Z",
};

describe("createEnvelopeForSource", () => {
  it("keeps the source it was given", () => {
    for (const source of ["shared_text", "notification", "file_extract", "pasted_text"] as const) {
      expect(createEnvelopeForSource({ ...base, source }).source).toBe(source);
    }
  });

  it("carries the content and the moment through unchanged", () => {
    const envelope = createEnvelopeForSource({ ...base, source: "shared_text" });

    expect(envelope).toMatchObject({
      userId: "user:1",
      rawContent: "Paid UGX 5,000 to Grocery",
      capturedAt: "2026-04-07T10:00:00.000Z",
      createdAt: "2026-04-07T10:00:00.000Z",
    });
  });

  it("stamps the moment itself when none is given", () => {
    const envelope = createEnvelopeForSource({
      userId: "user:1",
      rawContent: "Paid UGX 5,000",
      source: "shared_text",
    });

    expect(Number.isNaN(new Date(envelope.capturedAt).getTime())).toBe(false);
  });

  it("keeps who sent a shared capture and which app a notification came from", () => {
    expect(
      createEnvelopeForSource({
        ...base,
        source: "shared_text",
        sourceTitle: "MTN MoMo",
        sourceApp: "com.example.messages",
      }),
    ).toMatchObject({ sourceTitle: "MTN MoMo", sourceApp: "com.example.messages" });
  });

  /* Pasted text has no sender to record, so the adapter takes neither. Anything
     passed alongside it is dropped rather than stored against a source that
     cannot have come from anywhere. */
  it("drops a sender on text that was pasted in", () => {
    expect(
      createEnvelopeForSource({
        ...base,
        source: "pasted_text",
        sourceTitle: "MTN MoMo",
        sourceApp: "com.example.messages",
      }),
    ).toMatchObject({ sourceTitle: undefined, sourceApp: undefined });
  });

  it("gives the same text and source the same hash twice over", () => {
    const first = createEnvelopeForSource({ ...base, source: "shared_text" });
    const second = createEnvelopeForSource({ ...base, source: "shared_text" });

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.id).not.toBe(second.id);
  });

  it("hashes the same text differently once it arrives by another route", () => {
    expect(createEnvelopeForSource({ ...base, source: "shared_text" }).contentHash).not.toBe(
      createEnvelopeForSource({ ...base, source: "notification" }).contentHash,
    );
  });

  /* A notification is identified by the app that raised it as well as its text,
     because two apps saying the same thing are two events. */
  it("counts the app a notification came from as part of what it is", () => {
    expect(
      createEnvelopeForSource({ ...base, source: "notification", sourceApp: "com.bank.a" })
        .contentHash,
    ).not.toBe(
      createEnvelopeForSource({ ...base, source: "notification", sourceApp: "com.bank.b" })
        .contentHash,
    );
  });

  /* Shared text is identified by its text alone, so the same message forwarded
     naming two different senders is one capture. The sender is kept for the
     reviewer to read and is not part of what makes the capture distinct. */
  it("does not count the sender as part of what shared text is", () => {
    expect(
      createEnvelopeForSource({ ...base, source: "shared_text", sourceTitle: "Bank A" })
        .contentHash,
    ).toBe(
      createEnvelopeForSource({ ...base, source: "shared_text", sourceTitle: "Bank B" })
        .contentHash,
    );
  });
});

describe("createEnvelopeFromNativePayload", () => {
  /* This is the far end of the moat://capture contract a shortcut opens. */
  it("turns a shortcut capture into a shared-text envelope", () => {
    const envelope = createEnvelopeFromNativePayload({
      userId: "user:1",
      payload: {
        channel: "shared_text",
        source: "shared_text",
        rawContent: "Paid UGX 5,000 to Grocery",
        sourceTitle: "MTN MoMo",
        occurredAt: "2026-04-07T10:00:00.000Z",
      },
    });

    expect(envelope).toMatchObject({
      source: "shared_text",
      rawContent: "Paid UGX 5,000 to Grocery",
      sourceTitle: "MTN MoMo",
      capturedAt: "2026-04-07T10:00:00.000Z",
    });
  });

  it("turns a captured notification into a notification envelope", () => {
    expect(
      createEnvelopeFromNativePayload({
        userId: "user:1",
        payload: {
          channel: "notification",
          source: "notification",
          rawContent: "Paid UGX 5,000",
          sourceApp: "com.bank.app",
        },
      }),
    ).toMatchObject({ source: "notification", sourceApp: "com.bank.app" });
  });

  it("stamps the moment itself when a shortcut sent none", () => {
    const envelope = createEnvelopeFromNativePayload({
      userId: "user:1",
      payload: { channel: "shared_text", source: "shared_text", rawContent: "Paid UGX 5,000" },
    });

    expect(Number.isNaN(new Date(envelope.capturedAt).getTime())).toBe(false);
  });
});

describe("deriveTransactionSourceFromEnvelopeSource", () => {
  it("keeps a notification apart from the rest", () => {
    expect(deriveTransactionSourceFromEnvelopeSource("notification")).toBe("notification");
  });

  /* Everything else reaching capture is a message the user forwarded, however it
     travelled, so it is recorded the way a message would be. */
  it("records every other route as a message", () => {
    for (const source of ["shared_text", "pasted_text", "file_extract"] as const) {
      expect(deriveTransactionSourceFromEnvelopeSource(source)).toBe("sms");
    }
  });
});
