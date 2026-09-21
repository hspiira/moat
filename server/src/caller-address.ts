import type { IncomingHttpHeaders } from "node:http";

type AddressedRequest = {
  headers: IncomingHttpHeaders;
  socket: { remoteAddress?: string | undefined };
};

// Zero means the forwarded header is not read at all, which is the only safe
// default: a caller who can write it picks its own rate-limit bucket per
// request, and the limit that guards against token guessing is then no limit.
// A deployment behind a proxy has to say how many sit in front of it.
export function trustedProxyCount(env: Record<string, string | undefined> = process.env): number {
  return Math.max(0, Math.trunc(Number(env.MOAT_SYNC_TRUSTED_PROXIES ?? 0)) || 0);
}

export function callerAddress(request: AddressedRequest, trustedProxies: number): string {
  const socketAddress = (request.socket.remoteAddress ?? "unknown").trim();

  if (trustedProxies === 0) {
    return socketAddress;
  }

  const forwarded = request.headers["x-forwarded-for"];
  const hops = (Array.isArray(forwarded) ? forwarded.join(",") : (forwarded ?? ""))
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);

  // Counted from the right, because each proxy appends the address it was
  // reached from. Whatever a caller wrote itself sits further left than the
  // hops our own proxies added, so counting this way steps over it.
  return hops[hops.length - trustedProxies] ?? socketAddress;
}
