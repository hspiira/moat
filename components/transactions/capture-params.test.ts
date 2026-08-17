import { describe, expect, it } from "vitest";

import { readCaptureParams } from "./capture-params";

const read = (query: string) => readCaptureParams(new URLSearchParams(query));

describe("readCaptureParams", () => {
  it("finds nothing in a bare URL", () => {
    const result = read("");
    expect(result.intent).toBeNull();
    expect(result.hasPrefill).toBe(false);
  });

  it("takes the intent from a launcher shortcut", () => {
    expect(read("capture=expense").intent).toBe("expense");
    expect(read("capture=import").intent).toBe("import");
  });

  it("ignores an intent it does not recognise", () => {
    expect(read("capture=nonsense").intent).toBeNull();
  });

  it("joins the share sheet's fields and falls back to text capture", () => {
    const result = read("title=Airtel&text=UGX%205000&url=https%3A%2F%2Fx.test");
    expect(result.sharedInput).toBe("Airtel\nUGX 5000\nhttps://x.test");
    expect(result.intent).toBe("text");
  });

  it("skips share fields the sender left out", () => {
    expect(read("text=only").sharedInput).toBe("only");
  });

  it("keeps an explicit intent over the share fallback", () => {
    expect(read("capture=transfer&text=hi").intent).toBe("transfer");
  });

  it("reads the prefill a deep link carries", () => {
    const result = read("type=income&accountId=acc:1&amount=2500&payee=Rent");
    expect(result.prefill).toEqual({
      type: "income",
      accountId: "acc:1",
      amount: "2500",
      payee: "Rent",
    });
    expect(result.hasPrefill).toBe(true);
  });

  // An unrelated query param must not clear a half-typed form.
  it("does not report a prefill for foreign params", () => {
    expect(read("utm_source=whatsapp").hasPrefill).toBe(false);
  });
});
