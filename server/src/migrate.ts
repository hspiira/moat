import { closePool, getPool } from "./db/pool.js";
import { SCHEMA_SQL } from "./db/schema.js";

async function migrate() {
  await getPool().query(SCHEMA_SQL);
  console.log("schema applied");
}

migrate()
  .catch((error) => {
    console.error("migration failed", error);
    process.exitCode = 1;
  })
  .finally(closePool);
