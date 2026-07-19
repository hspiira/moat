# Moat Documentation

The documentation is organized by purpose. When docs disagree, [tracker.md](tracker.md) wins on current status; the PRD wins on product intent.

## Map

| Doc | Purpose |
|-----|---------|
| [tracker.md](tracker.md) | **Single source of truth** for project status, decisions, and backlog |
| [product/blueprint.md](product/blueprint.md) | Founding product vision, personas, and MVP scope |
| [product/prd.md](product/prd.md) | Product requirements with acceptance criteria |
| [product/open-questions.md](product/open-questions.md) | Unanswered strategy questions (monetization, distribution, analytics, compliance ownership) |
| [architecture/overview.md](architecture/overview.md) | Current system architecture as implemented |
| [architecture/storage-security.md](architecture/storage-security.md) | Storage backends, encryption, and backup design |
| [architecture/sync.md](architecture/sync.md) | Sync API contract and conflict rules (server side is dev-only) |
| [plans/phase-2-capture.md](plans/phase-2-capture.md) | Capture platform implementation plan |
| [research/roadmap-and-opportunities.md](research/roadmap-and-opportunities.md) | Market, regulatory, and SMS/capture research compendium |
| [testing/pilot-readiness.md](testing/pilot-readiness.md) | Pilot release gate and QA script |
| [testing/pwa-install-test-plan.md](testing/pwa-install-test-plan.md) | PWA install and offline test plan |

## Conventions

- The product is called **Moat** everywhere. Older names (Uganda Finance App) are retired.
- Docs carry a status header (`Active`, `Draft`, `Superseded`). Superseded docs say what replaced them.
- Status claims (built / not built / verified) live only in the tracker; other docs link to it instead of restating status.
