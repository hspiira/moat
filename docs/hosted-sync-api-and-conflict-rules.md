# Hosted Sync API and Conflict Rules

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Active contract |
| Owner | Piira |
| Last Updated | 06-04-2026 |

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
