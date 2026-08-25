// The app is called back on a scheme derived from the Google iOS client id, and
// iOS only delivers it if Info.plist declares the same scheme. Two places
// holding one value drift, so this writes the plist from the environment.
export function schemeFor(iosClientId) {
  const withoutSuffix = iosClientId.trim().replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${withoutSuffix}`;
}

const BLOCK_START = "<!-- moat:sign-in-scheme -->";
const BLOCK_END = "<!-- /moat:sign-in-scheme -->";

export function withUrlScheme(plist, scheme) {
  const block = [
    `\t${BLOCK_START}`,
    "\t<key>CFBundleURLTypes</key>",
    "\t<array>",
    "\t\t<dict>",
    "\t\t\t<key>CFBundleURLSchemes</key>",
    "\t\t\t<array>",
    `\t\t\t\t<string>${scheme}</string>`,
    "\t\t\t\t<string>moat</string>",
    "\t\t\t</array>",
    "\t\t</dict>",
    "\t</array>",
    `\t${BLOCK_END}`,
  ].join("\n");

  // Replacing its own block keeps this safe to run again, and leaves anything
  // Xcode added by hand alone.
  const existing = new RegExp(`\\t?${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`, "");
  const cleaned = plist.replace(existing, "");

  return cleaned.replace("</dict>\n</plist>", `${block}\n</dict>\n</plist>`);
}
