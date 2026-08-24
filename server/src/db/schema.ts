export const SCHEMA_SQL = `
create table if not exists sync_users (
  user_id     text primary key,
  created_at  text not null
);

create table if not exists sync_credentials (
  token_sha256 text primary key,
  user_id      text not null,
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
