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
app through the `@/` alias. The bundle lands at `server.js` in this directory,
which is also what makes the package deployable to Vercel — see below.

## Environment

Copy `.env.example` to `.env`. Every variable is documented there.

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

## Deploying to Vercel with Neon

This deploys as its own Vercel project, separate from the web app, because the
web app is a static export and cannot host route handlers.

Vercel captures a Node HTTP server: it looks for `server.js` in the project root
(or `src/`) and turns the `listen()` call into a function. The esbuild step
produces exactly that, which also sidesteps Vercel's lack of support for
TypeScript path mappings — `@/lib/sync/...` is resolved at build time rather
than at runtime.

1. Create a second Vercel project from this repository with **Root Directory**
   set to `server`.
2. Vercel runs the `vercel-build` script, which produces `server.js`.
3. Set the environment variables from the table above. Use Neon's **pooled**
   connection string (the host with `-pooler`).
4. Run the migration once against the same database:
   `DATABASE_URL=... pnpm --filter @moat/sync-server migrate`
5. Check `GET /health`. It names whatever is missing.

Two things that make this work with a pooled, scale-to-zero database:

- Tenancy is set with `set_config('moat.user_id', $1, true)`. The `true` makes
  it transaction-scoped, which is what PgBouncer transaction pooling allows. A
  session-scoped setting would leak across pooled connections or be rejected.
- The pool is a module-level singleton, so a warm function reuses connections
  instead of opening one per request.

Leave `DATABASE_SSL` unset for Neon. Certificates are verified by default and
Neon presents a normally-trusted certificate.

**Untested.** This describes the documented Vercel behaviour and the local
build, not a deployment that has been run. Verify `/health` first.

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
export MOAT_SYNC_BEARER_TOKEN=<generate one, e.g. openssl rand -hex 32>
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
