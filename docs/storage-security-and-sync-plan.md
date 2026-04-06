# Storage, Security, and Sync Plan

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Active architecture plan |
| Owner | Piira |
| Last Updated | 06-04-2026 |

## Decision

Moat should use a split storage strategy:

- **Web / PWA**: IndexedDB with non-destructive schema migrations and encrypted backup/export
- **Native Android / iOS shells**: encrypted SQLite with device-protected keys
- **Optional hosted sync**: Postgres, enabled only when the user explicitly opts in

This keeps the app local-first while allowing stronger durability and multi-device sync later.

## Offline and low-connectivity behavior

Moat should remain usable with poor network or no network at all.

- all accounting writes happen locally first
- the local database remains the source of truth while offline
- opted-in hosted sync users build a local outbox of pending changes
- when connectivity returns, that outbox can be replayed to Postgres

This means:

- non-opted-in users stay fully local-only
- opted-in users continue working offline and sync later

For the web/PWA build, the durable local store is IndexedDB. `localStorage` should not be the
primary accounting datastore because it is too limited for structured finance records, imports,
review queues, and migration safety.

## Why this is necessary

The previous IndexedDB upgrade path reset all stores on schema changes. That made application
updates destructive. Financial history cannot be treated as disposable application cache.

Moat needs:

1. upgrade-safe local persistence
2. stronger native storage for mobile shells
3. clear separation between local-only use and cloud-backed sync

## Storage modes

### 1. Local-only web/PWA mode

Default mode for browser and installable web usage.

- storage backend: IndexedDB
- upgrades: migration-only, never reset stores during normal release upgrades
- backup: encrypted export required for resilience
- risk: browser storage can still be cleared by the user or browser policies

### 2. Local-only native mode

Default mode for Android/iOS native shells.

- storage backend: SQLite
- encryption: encrypted database file
- key storage:
  - iOS Keychain
  - Android Keystore
- unlock:
  - app PIN
  - biometrics where available

This is the preferred long-term mode for durable on-device accounting.

### 3. Optional hosted sync mode

Not mandatory. Users must opt in deliberately.

- storage backend: Postgres
- purpose:
  - device migration
  - multi-device continuity
  - disaster recovery
- encryption:
  - in transit: TLS
  - at rest: database/storage encryption plus encrypted application secrets
- user control:
  - opt in
  - opt out
  - export data
  - delete synced data

## Security model

### At rest

- web/PWA:
  - local database protected by browser origin boundaries
  - encrypted backup/export for portability
- native:
  - encrypted SQLite database
  - key material stored via Keychain/Keystore

### In transit

Only relevant when optional sync is enabled.

- TLS required for all transport
- certificate-valid HTTPS only
- no silent background upload without prior consent

### App access control

- PIN lock supported
- biometric unlock supported in native shells where available
- session auto-lock after inactivity

## Repository strategy

The repository abstraction should support three backends:

1. `IndexedDbRepositoryBundle`
2. `SqliteRepositoryBundle`
3. `PostgresSyncRepositoryBundle` or sync service layered above local repositories

The app should continue to use the same domain layer regardless of the active backend.

## Privacy policy impact

The privacy policy must state clearly:

- local-only mode is the default
- optional sync is opt-in, not mandatory
- what data is stored remotely if sync is enabled
- how encryption works at rest and in transit
- how users disable sync and delete synced data

## Immediate implementation order

1. stop destructive IndexedDB upgrades
2. add explicit migration steps and schema metadata
3. keep encrypted backup/export prominent in settings
4. finish Android native shell storage around encrypted SQLite
5. add iOS native shell storage with the same repository contract
6. design opt-in sync with Postgres only after privacy and consent UX are ready
