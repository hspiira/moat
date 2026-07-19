# Moat

Moat is a Uganda-first, local-first personal finance app: spending visibility, goal-based savings, and rule-based investment guidance for people managing money across cash, mobile money, bank, and SACCO accounts. Data lives on the device (IndexedDB on web, SQLite via a native bridge inside the Android shell), protected by a PIN-derived encryption key, with optional encrypted backups.

## Status

Active development, pre-pilot. Built and working:

- Onboarding (profile, first account, first goal, PIN + encryption by default) at `/onboarding`, with encrypted backup restore
- Accounts with running ledgers and balance reconciliation at `/accounts`
- Transactions — manual entry, transfers, CSV import, rules, recurring obligations, budgets, and month close at `/transactions`
- Capture platform — paste/share/file intake, parser packs (MTN, Airtel, generic bank), confidence scoring, dedupe, and a review-first inbox at `/transactions/review/capture`
- Goals with contribution plans and progress derived from savings transactions at `/goals`
- Rule-based Investment Compass at `/investment-compass` and curated learning resources at `/learn`
- PIN lock (min 6 digits, throttled unlock) with at-rest record encryption; encrypted backup/restore to file or Google Drive
- PWA install + offline support; a native Android WebView shell with share-to-app capture (in `native/android`, not yet device-verified)

Not built yet: hosted multi-device sync (the client engine and contract exist; the server is a dev-only stub), PDF statement parsing, Android notification-listener rollout, push reminders.

See [docs/tracker.md](docs/tracker.md) for the authoritative, up-to-date status.

## Getting started

```bash
pnpm install
pnpm dev        # run the app at http://localhost:3000
pnpm typecheck  # TypeScript
pnpm lint       # ESLint
pnpm test       # Vitest (domain, sync, capture, security, PWA)
pnpm build      # production build
```

All four checks run in CI on every push and pull request.

## Repository layout

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router routes (thin server shells over client workspaces) |
| `components/` | UI workspaces, forms, and shadcn/ui primitives |
| `lib/domain/` | Pure, tested financial logic (ledgers, summaries, goals, rules, reconciliation) |
| `lib/repositories/` | Storage abstraction with parallel IndexedDB and SQLite backends |
| `lib/capture/` | Capture pipeline: source adapters, parser packs, confidence, dedupe |
| `lib/sync/` | Offline outbox sync engine and conflict rules (server side is dev-only) |
| `lib/security/` | PIN policy, PIN lock, record encryption, encrypted backups |
| `native/android/` | Kotlin WebView host shell with capture and storage bridges |
| `docs/` | Product, architecture, plans, research, and testing docs — see [docs/README.md](docs/README.md) |

## Documentation

- [docs/README.md](docs/README.md) — documentation map
- [docs/tracker.md](docs/tracker.md) — single source of truth for status and decisions
- [docs/product/prd.md](docs/product/prd.md) — product requirements
- [docs/architecture/overview.md](docs/architecture/overview.md) — how the system actually works
