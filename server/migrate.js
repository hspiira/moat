import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// src/db/pool.ts
import pg from "pg";
var pool = null;
function getPool() {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: resolveSsl()
  });
  return pool;
}
function resolveSsl() {
  switch (process.env.DATABASE_SSL) {
    case "disable":
      return void 0;
    case "no-verify":
      return { rejectUnauthorized: false };
    default:
      return { rejectUnauthorized: true };
  }
}
async function closePool() {
  await pool?.end();
  pool = null;
}

// src/db/schema.ts
var SCHEMA_SQL = `
create table if not exists sync_users (
  user_id     text primary key,
  created_at  text not null
);

create table if not exists sync_credentials (
  token_sha256 text primary key,
  user_id      text not null
                 constraint sync_credentials_user_fk
                 references sync_users(user_id) on delete cascade,
  label        text,
  created_at   text not null,
  last_used_at text
);

create index if not exists sync_credentials_user_idx
  on sync_credentials (user_id);

create table if not exists sync_records (
  user_id              text not null references sync_users(user_id) on delete cascade,
  entity_type          text not null,
  entity_id            text not null,
  entity_key           text collate "C" generated always as (entity_type || ':' || entity_id) stored,
  payload              text,
  deleted              boolean not null default false,
  updated_at           text collate "C" not null,
  server_version_token text not null,
  last_outbox_id       text,
  last_device_id       text,
  primary key (user_id, entity_type, entity_id)
);

create index if not exists sync_records_pull_idx
  on sync_records (user_id, updated_at, entity_key);

create table if not exists sync_applied_outbox (
  user_id     text not null references sync_users(user_id) on delete cascade,
  outbox_id   text not null,
  applied_at  text not null,
  primary key (user_id, outbox_id)
);

-- One row per provider account. The subject is what identifies a person; an
-- email can be reassigned by the provider and must never be the key.
create table if not exists sync_identities (
  issuer      text not null,
  subject     text not null,
  user_id     text not null references sync_users(user_id) on delete cascade,
  email       text,
  created_at  text not null,
  primary key (issuer, subject)
);

-- Not unique: a second provider may be linked to the same ledger later.
create index if not exists sync_identities_user
  on sync_identities (user_id);

-- One clock for every timestamp the server writes: an updated_at stamped by a
-- machine running behind lands under a cursor a client already holds, and that
-- record is then one it can never pull. Milliseconds because these are compared
-- as text, and a wider fraction would not sort against the values already written.
create or replace function moat_now_iso() returns text
  language sql
  stable
  as $$ select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- Applied by name because an existing deployment skips the create above. Until
-- it holds, deleting a user leaves its tokens working: resolving one reads only
-- sync_credentials, and the next push recreates the user row it named.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sync_credentials_user_fk') then
    -- Hand-minted tokens for a ledger that has not synced yet have no user row
    -- and are legitimate, so the rows are filled in rather than the tokens cut.
    insert into sync_users (user_id, created_at)
    select distinct c.user_id, moat_now_iso()
      from sync_credentials c
     where not exists (select 1 from sync_users u where u.user_id = c.user_id)
    on conflict (user_id) do nothing;

    alter table sync_credentials
      add constraint sync_credentials_user_fk
      foreign key (user_id) references sync_users(user_id) on delete cascade;
  end if;
end
$$;

alter table sync_records enable row level security;
alter table sync_records force row level security;
alter table sync_applied_outbox enable row level security;
alter table sync_applied_outbox force row level security;

drop policy if exists sync_records_tenant on sync_records;
create policy sync_records_tenant on sync_records
  using (user_id = current_setting('moat.user_id', true))
  with check (user_id = current_setting('moat.user_id', true));

drop policy if exists sync_applied_outbox_tenant on sync_applied_outbox;
create policy sync_applied_outbox_tenant on sync_applied_outbox
  using (user_id = current_setting('moat.user_id', true))
  with check (user_id = current_setting('moat.user_id', true));
`;

// src/migrate.ts
async function migrate() {
  await getPool().query(SCHEMA_SQL);
  console.log("schema applied");
}
migrate().catch((error) => {
  console.error("migration failed", error);
  process.exitCode = 1;
}).finally(closePool);
//# sourceMappingURL=migrate.js.map
