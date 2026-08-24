import { readFileSync, writeFileSync, existsSync } from "node:fs";

import { schemeFor, withUrlScheme } from "./ios-url-scheme.mjs";

const PLIST = "ios/App/App/Info.plist";

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  );
}

const env = { ...readEnvFile(".env"), ...process.env };
const clientId = env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

if (!clientId) {
  console.log(
    "NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID is not set, so the app cannot be called back after signing in. Everything else still builds.",
  );
  process.exit(0);
}

if (!existsSync(PLIST)) {
  console.log(`${PLIST} is missing, so there is no iOS app to configure.`);
  process.exit(0);
}

const scheme = schemeFor(clientId);
const before = readFileSync(PLIST, "utf8");
const after = withUrlScheme(before, scheme);

if (after === before) {
  console.log(`Info.plist already declares ${scheme}.`);
} else {
  writeFileSync(PLIST, after);
  console.log(`Info.plist now declares ${scheme}.`);
}
