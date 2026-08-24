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
the iOS project, then deletes `ios/App/CapApp-SPM/.build`.

That last step is hygiene rather than a known cure. `.build` is command-line
Swift package state, and Xcode keeps its own resolution in DerivedData, so
clearing it means only one tool has resolved the package. Xcode recreates the
directory while the project is open, which is normal. If Xcode still reports a
package as "already opened from another project or workspace", or a plugin
product as missing, reset its own state with File, Packages, Reset Package
Caches.

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
