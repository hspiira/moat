# Hosted Sync API and Conflict Rules

| Field | Value |
| --- | --- |
| Document Version | 1.1 |
| Status | Active contract — **server implementation is dev-only** |
| Owner | Piira |
| Last Updated | 2026-07-19 |

> **⚠️ The server side of this contract is a development stub.** The hosted
> store (`lib/sync/hosted-store.ts`) is a single-process JSON file with a
> shared bearer token, no per-user authentication, and no tenancy — `userId`
> is trusted from the request body. Routes return 501 unless explicitly
> flag-enabled and fail closed (503) if `MOAT_SYNC_BEARER_TOKEN` is unset.
> Before hosted sync is offered to anyone: per-user auth, a real database,
> rate limiting, and a threat-model review are prerequisites. The client
> engine, outbox, and conflict rules below are real and tested.

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
      "queuedAt": "2026-04-06T00:00:00.000Z"
    }
  ]
}
```

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

## Current server implementation boundary

The app now exposes a guarded route contract for `/api/v1/sync/push`.

- if `MOAT_ENABLE_SYNC_STUB=true`, the route accepts payloads and returns a stub success response
- otherwise it returns `501 Not Implemented`

This keeps the client transport and outbox behavior testable without pretending the full Postgres
backend already exists.
