# Moat

A local-first money app for Uganda. Cash, mobile money, bank and SACCO accounts
in one ledger, on your own device.

Data lives on the phone, IndexedDB on web and SQLite in the Android shell,
encrypted with a key derived from your PIN. Backups are encrypted too. Nothing
leaves the device unless you turn on sync, which is off until you do.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm verify     # typecheck, lint, build, tests, browser journeys. What CI runs
```

## iOS

```bash
pnpm ios
```

Builds, writes the sign-in callback scheme into Info.plist, copies the app into
the iOS project, then deletes `ios/App/CapApp-SPM/.build`. That last step
matters: `cap sync` resolves the Swift package from the command line and leaves
its state behind, and Xcode then refuses to open the same package, saying it is
"already opened from another project or workspace".

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
