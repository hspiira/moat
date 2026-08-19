# Hosted Sync API and Conflict Rules

| Field | Value |
| --- | --- |
| Document Version | 1.3 |
| Status | Active contract — **payloads are still plaintext** |
| Owner | Piira |
| Last Updated | 2026-08-19 |

> **⚠️ Payloads are still plaintext.** `sync_records.payload` holds the record
> as JSON, so the server reads every transaction, payee and amount. That is the
> remaining blocker and hosted sync stays behind
> `NEXT_PUBLIC_ENABLE_HOSTED_SYNC` until it is closed.
>
> Tenancy is no longer self-asserted. The bearer token is bound to one user id
> server-side (`MOAT_SYNC_BEARER_USER_ID`); the authenticated user is the only
> one a request may act as, and a body claiming another user gets a 403. Both
> variables are required, and the server fails closed (503) without them
> rather than letting an unauthenticated caller through. Token comparison is
> constant-time. Rate limiting and a threat-model review are still
> prerequisites before this is offered to anyone else.

## Purpose

This document defines the first hosted sync contract for Moat.

The model stays:

- local database first
- sync outbox second
- hosted Postgres optional

Hosted sync is therefore a replay target, not the primary write path.

## Push endpoint

`POST /api/v1/sync/push`

### Request

```json
{
  "userId": "u1",
  "device": {
    "app": "moat",
    "platform": "web"
  },
  "items": [
    {
      "outboxId": "sync-outbox:1",
      "entityType": "transactions",
      "entityId": "transaction:1",
      "operation": "upsert",
      "payload": "{\"id\":\"transaction:1\"}",
      "queuedAt": "2026-04-06T00:00:00.000Z",
      "baseVersionToken": "sv:9c1f..."
    }
  ]
}
```

`baseVersionToken` is the `serverVersionToken` the edit was based on. The server
uses it to tell a newer version apart from a divergent one. It is optional, and
the client does not send it yet: without it the server falls back to comparing
payloads, which cannot make that distinction, so a device editing a record it
already synced is reported as a conflict. Closing that gap needs the client to
persist the token per record. See [../plans/hosted-sync.md](../plans/hosted-sync.md).

### Response

```json
{
  "syncedAt": "2026-04-06T12:00:00.000Z",
  "results": [
    {
      "outboxId": "sync-outbox:1",
      "status": "synced"
    }
  ]
}
```

## Conflict rules

The current default strategies are:

- `client_wins`
  - user profiles
  - categories
  - investment profiles
  - transaction rules
- `server_wins`
  - month close records
- `manual_review`
  - accounts
  - transactions
  - goals
  - budgets
  - recurring obligations

## Why this split

Manual review is required for ledger-affecting records. If the same transaction or account state
has diverged on two devices, automatic overwrite is too risky for accounting correctness.

## Pull paging

Pull is paged with a keyset cursor. `since` carries the previous page's
`nextSince`, and the response reports `hasMore`.

The cursor pairs `updatedAt` with the entity key rather than being a bare
timestamp. Records written in the same millisecond sort together, so a page
boundary landing inside such a group would either drop the rest of it or replay
it forever. The pair is unique, so boundaries are exact.

`nextSince` advances only past records actually returned, never to the server
clock, so a write landing between the query and the response is not skipped.
A bare timestamp is still accepted for profiles written before paging existed.

## First-sync backfill

The outbox is only written once hosted sync is on, so records created before
opt-in have no outbox entry. `lib/sync/backfill.ts` walks every syncable store
on opt-in and seeds the outbox from what is already there. It matches existing
outbox entries by entity key, so an interrupted run resumes instead of
double-queueing, and it marks `backfilledAt` on the sync profile when done.

## Current server implementation boundary

The server lives in [`server/`](../../server/) and deploys separately, because
the web app is a static export and cannot host route handlers. It runs on
Postgres: pushes apply in one transaction per batch with `for update` row locks
taken in entity-key order, and tenancy is enforced by row-level security rather
than by query text alone.

What is still missing is authentication. One shared bearer token is not per-user
identity. See [../plans/hosted-sync.md](../plans/hosted-sync.md).

`lib/sync/hosted-store.ts` remains as a file-backed store for local development
and tests. It is not a deployment target.
