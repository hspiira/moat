import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Every route ships as a real file.
   *
   * Moat holds its data in IndexedDB and computes everything client-side, so a
   * server round-trip on navigation bought nothing — but it cost the two things
   * the app promises. Offline became "whatever happened to be cached", and each
   * failed route fetch forced a full document load, which remounted the PIN
   * provider and asked for the PIN again. Exporting removes the round-trip, so
   * offline is a property of the build and navigation never leaves the client.
   *
   * The trade: no route handlers in this build. The sync endpoints live in
   * server/sync/ and deploy separately once there is a backend to talk to.
   */
  output: "export",
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
