# Uganda Finance MVP Pilot Readiness Checklist


| Field         | Value      |
| ------------- | ---------- |
| Status        | Draft      |
| Owner         | `Piira`    |
| Last updated  | 2026-04-05 |
| Related issue | `#10`      |


## Purpose

This checklist is the release-quality handoff for the first Uganda pilot. It defines what must be verified before the product is shown to real users, what evidence to collect during the pilot, and which failure modes would invalidate the pilot signal.

## Release Gate

The pilot is ready only when all of the following are true:

- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run test` passes.
- Core routes work end-to-end with local-first persistence:
  - `/accounts`
  - `/transactions`
  - `/goals`
  - `/investment-compass`
  - `/learn`
- Source links on the investing and learning routes have been spot-checked manually.
- Guidance copy contains no stock tips, no guaranteed-return claims, and no unlicensed personalized advice.

## QA Scope

### Domain logic

- Account reconciliation reflects income, expense, savings, debt payment, and transfer movements correctly.
- Monthly summaries exclude transfers from spending totals.
- Goal contribution math handles partial progress and short deadlines.
- Investment guidance changes correctly with:
  - short versus long time horizons
  - low emergency-fund coverage
  - debt-payment signals
  - liquidity needs

### Product flows

- New user can complete onboarding and create at least one account.
- User can add, edit, and delete manual transactions.
- User can import a CSV, review mapped rows, and confirm valid imports.
- Dashboard updates after transaction changes without manual refresh.
- Goal progress changes after savings contribution activity.
- Investment profile edits persist and change guidance output.

### UX and trust

- Empty states explain what the user should do next.
- Money labels use `UGX` consistently.
- Local examples are visible in category and copy choices.
- Official sources are labeled clearly where shown.

## Evidence To Capture During Pilot

- Setup completion rate
- Number of accounts created in first session
- Number of manual transactions entered in first session
- Whether users can explain the dashboard without facilitator help
- Whether users understand the difference between:
  - spending
  - savings
  - transfers
  - investing guidance
- Which route causes the most confusion or drop-off

## Pilot Script

Use this lightweight script for the first five users:

1. Ask the user to complete onboarding and create their main money accounts.
2. Ask the user to record one week of typical spending or import sample CSV data.
3. Ask the user to create one emergency fund goal and one non-emergency goal.
4. Ask the user to explain what the Investment Compass is telling them in their own words.
5. Ask the user which part of the product they trust least and why.

## Failure Conditions

Pause the pilot if any of these happen repeatedly:

- Users interpret the app as direct investment advice.
- Transfers inflate spending or savings numbers.
- Goal progress is clearly wrong after normal transaction flows.
- CSV import produces unreviewable or misleading records.
- Source links or regulation references are broken or mislabeled.

## Next Steps After Pilot

- Convert repeated usability failures into GitHub issues with route and reproduction context.
- Add event instrumentation once the first pilot identifies the actual bottlenecks worth measuring.
- Decide whether the next engineering wave should prioritize:
  - stronger transaction categorization
  - better onboarding defaults
  - richer goal planning
  - institution verification depth

