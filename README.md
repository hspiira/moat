# Moat

A local-first money app for Uganda. Cash, mobile money, bank and SACCO accounts
in one ledger, on your own device.

Data lives on the phone — IndexedDB on web, SQLite in the Android shell —
encrypted with a key derived from your PIN. Backups are encrypted too. Nothing
leaves the device unless you turn on sync, which is not finished yet.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm verify     # typecheck, lint, build, tests, browser journeys — what CI runs
```

## Where things are

| Path | What |
|------|------|
| `app/` | Routes |
| `components/` | Screens and UI |
| `lib/domain/` | Money logic, pure and tested |
| `lib/repositories/` | Storage, IndexedDB and SQLite |
| `lib/capture/` | Reading transactions out of messages |
| `lib/sync/` | Offline outbox and conflict rules |
| `lib/security/` | PIN, encryption, backups |
| `server/` | Sync server |
| `native/android/` | Android shell |
| `e2e/` | Browser journeys |

## Docs

[docs/tracker.md](docs/tracker.md) is the status of record. Start there.
[docs/README.md](docs/README.md) maps the rest.
