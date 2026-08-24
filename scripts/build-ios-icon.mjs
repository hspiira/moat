// Renders public/icons/ios-icon.svg into the iOS app icon slot.
// iOS masks its own corners and rejects an alpha channel, so the art is
// full-bleed and flattened on the way through.
import { execFileSync } from "node:child_process";
import { mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const source = "public/icons/ios-icon.svg";
const target = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
const work = mkdtempSync(path.join(tmpdir(), "moat-icon-"));

execFileSync("qlmanage", ["-t", "-s", "1024", "-o", work, source], { stdio: "ignore" });
const rendered = path.join(work, "ios-icon.svg.png");
const flattened = path.join(work, "flat.jpg");
const out = path.join(work, "icon.png");

execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "best", rendered, "--out", flattened], { stdio: "ignore" });
execFileSync("sips", ["-s", "format", "png", flattened, "--out", out], { stdio: "ignore" });
copyFileSync(out, target);

console.log(`Wrote ${target} from ${source}.`);
