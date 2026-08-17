# Moat sync server

The hosted sync API. Deployed separately from the web app, which is a static
export (`output: "export"`) and cannot host route handlers.

**Not ready for real users.** Authentication is still a single shared bearer
token, so `userId` is trusted from the request body and any caller holding the
token can act as any user. Per-user auth is a prerequisite before this is
offered to anyone. See [../docs/plans/hosted-sync.md](../docs/plans/hosted-sync.md).

## Running it

```bash
pnpm --filter @moat/sync-server build
DATABASE_URL=postgres://... MOAT_SYNC_BEARER_TOKEN=... pnpm --filter @moat/sync-server migrate
DATABASE_URL=postgres://... MOAT_SYNC_BEARER_TOKEN=... pnpm --filter @moat/sync-server start
```

`build` bundles with esbuild because the handlers share `lib/sync` with the web
app through the `@/` alias.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `MOAT_SYNC_BEARER_TOKEN` | yes | Shared token. Endpoints return 503 without it |
| `MOAT_SYNC_ALLOWED_ORIGINS` | for browsers | Comma-separated origin allowlist for CORS |
| `PORT` | no | Defaults to 8787 |
| `DATABASE_SSL` | no | `disable`, or `no-verify` to skip certificate checks |
| `DATABASE_POOL_MAX` | no | Defaults to 10 |

Certificates are verified by default. `no-verify` exists for providers whose
certs the default trust store rejects, but it removes the protection TLS gives
against an interceptor.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Checks the database is reachable |
| `POST` | `/v1/sync/push` | Apply queued client changes |
| `POST` | `/v1/sync/pull` | Fetch changes after a cursor |

## Schema notes

Timestamps are stored as text, and the ordering columns use `collate "C"`, so
the server orders records exactly the way the client compares cursors. See
[src/db/schema.ts](src/db/schema.ts).

Pushes run in one transaction per batch, locking each row with `for update` and
taking rows in entity-key order so two devices pushing overlapping sets cannot
deadlock.

Tenancy is enforced by row-level security on `moat.user_id`, set per
transaction, so a query that loses its `user_id` predicate returns nothing
rather than another user's rows.

## Local setup

```bash
createdb moat_dev
export DATABASE_URL=postgres://localhost/moat_dev DATABASE_SSL=disable
export MOAT_SYNC_BEARER_TOKEN=dev-token
pnpm --filter @moat/sync-server build
pnpm --filter @moat/sync-server migrate
pnpm --filter @moat/sync-server start
```

`GET /health` reports what is missing if either variable is unset.

## Tests

The store tests need a throwaway database and are skipped without one. They
drop and recreate their tables, so do not point them at anything real.

```bash
createdb moat_test
DATABASE_SSL=disable DATABASE_URL=postgres://localhost/moat_test pnpm test
```

One of them creates a temporary unprivileged role to check row-level security
actually enforces tenancy. The role that runs the suite is usually a superuser,
and superusers bypass RLS, so without that the policies would go untested.
