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
DATABASE_URL=postgres://... pnpm --filter @moat/sync-server migrate
DATABASE_URL=postgres://... pnpm --filter @moat/sync-server start
```

The server reads its configuration from the real environment and loads no
`.env` of its own, so the variables have to be exported in the shell that
starts it, or supplied by the host.

`build` bundles with esbuild because the handlers share `lib/sync` with the web
app through the `@/` alias. The bundle lands at `server.js` in this directory,
which is also what makes the package deployable to Vercel. See below.

## Environment

Set these in the Vercel project, or copy the repository's `.env.example` to `.env.local` for development. Every variable is documented there.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `MOAT_OIDC_GOOGLE_CLIENT_ID` | to sign in | Google **Web** client id, the same one the browser starts with |
| `MOAT_OIDC_GOOGLE_CLIENT_SECRET` | to sign in | Secret for that web client |
| `MOAT_OIDC_REDIRECT_URIS` | to sign in | Comma-separated allowlist, matched exactly against what the caller asks for |
| `MOAT_OIDC_GOOGLE_IOS_CLIENT_ID` | for the app | Google **iOS** client id. A web client id will not work here |
| `MOAT_SYNC_ALLOWED_ORIGINS` | for browsers | Comma-separated origin allowlist for CORS |
| `MOAT_SYNC_TRUSTED_PROXIES` | behind a proxy | How many proxies sit in front of this server. Defaults to `0`, which ignores `x-forwarded-for` |
| `PORT` | no | Defaults to 8787 |
| `DATABASE_SSL` | no | `disable`, or `no-verify` to skip certificate checks |
| `DATABASE_POOL_MAX` | no | Defaults to 10 |

Certificates are verified by default. `no-verify` exists for providers whose
certs the default trust store rejects, but it removes the protection TLS gives
against an interceptor.

`MOAT_SYNC_TRUSTED_PROXIES` decides what the rate limits count. The default of
`0` reads the connecting socket and ignores `x-forwarded-for`, because a caller
free to write that header picks a fresh bucket per request and the ten failed
authentications a minute that stand between someone and a guessed token stop
counting. **On Vercel set it to `1`**: the socket there is Vercel's edge, so
leaving it at `0` puts every caller in one bucket and the first busy client
starts refusing the rest.

## Deploying to Vercel with Neon

One Vercel project, not two. `vercel.json` declares this as a service alongside
the web app, so both build from the same repository, share one set of
environment variables, and answer on one domain.

Vercel captures a Node HTTP server: it looks for `server.js` in the service root
and turns the `listen()` call into a function. The esbuild step produces exactly
that, which also sidesteps Vercel's lack of support for TypeScript path mappings
`@/lib/sync/...` is resolved at build time rather than at runtime.

Routing sends `/v1/sync/*` and `/health` here and everything else to the web
app. Because both answer on the same origin, sync requests are not cross-origin,
no preflight happens, and `MOAT_SYNC_ALLOWED_ORIGINS` can stay unset.

1. Import the repository as one Vercel project.
2. Set the variables from `.env.example` in the project.
3. Run the migration once against the same database:
   `DATABASE_URL=... pnpm --filter @moat/sync-server migrate`
4. Check `GET /health`. It names whatever is missing.

Services is a gated Vercel feature. If it is unavailable on the account, the
fallback is a second project with **Root Directory** set to `server`, in which
case the app and the API sit on different origins and
`MOAT_SYNC_ALLOWED_ORIGINS` becomes required.

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

Two of them create temporary roles to check row-level security actually
enforces tenancy. The role that runs the suite is usually a superuser, and
superusers bypass RLS, so without them the policies would go untested. One role
merely holds grants. The other owns the tables, which is what a deployment
connects as, and Postgres lets an owner past its own policies unless the table
forces them.
