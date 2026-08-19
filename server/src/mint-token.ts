import { closePool } from "./db/pool.js";
import { mintSyncCredential, revokeSyncCredentials } from "./db/credentials.js";

const [command, userId, label] = process.argv.slice(2);

function usage(): never {
  console.error("usage: mint-token <mint|revoke> <userId> [label]");
  process.exit(1);
}

if (!userId || (command !== "mint" && command !== "revoke")) {
  usage();
}

try {
  if (command === "mint") {
    const token = await mintSyncCredential(userId, label);
    console.log(token);
    console.error(`Minted a sync token for ${userId}. It is shown once; store it now.`);
  } else {
    const removed = await revokeSyncCredentials(userId);
    console.error(`Revoked ${removed} token${removed === 1 ? "" : "s"} for ${userId}.`);
  }
} finally {
  await closePool();
}
