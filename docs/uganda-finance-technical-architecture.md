# Uganda Finance App Technical Architecture


| Field            | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| Document Version | 1.0                                                                  |
| Status           | Draft                                                                |
| Owner            | Piira                                                                |
| Last Updated     | 2026-04-05                                                           |
| Related Docs     | `docs/uganda-finance-mvp-blueprint.md`, `docs/uganda-finance-prd.md` |


## Architecture Summary

This architecture proposes a pragmatic v1 foundation for a mobile-first finance app with manual entry and CSV import. The initial stack is optimized for fast iteration, low complexity, and future extensibility.

Recommended v1 stack:

- Next.js with App Router
- TypeScript
- React
- local-first UI state for early development
- JSON or lightweight persistence abstraction during scaffold phase
- future upgrade path to Postgres and authenticated APIs

The immediate goal is to create a clean app skeleton and shared domain model, not a production-ready infrastructure footprint.

## System Goals

- support a mobile-first web app or installable PWA direction
- keep UI and domain model easy to evolve
- avoid early lock-in to fragile financial integrations
- allow future migration from static demo data to persistent storage
- isolate finance logic into reusable utilities and domain types

## Proposed Repository Structure

```text
/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── dashboard-shell.tsx
│   ├── feature-card.tsx
│   ├── milestone-list.tsx
│   └── section-title.tsx
├── docs/
│   ├── uganda-finance-mvp-blueprint.md
│   ├── uganda-finance-prd.md
│   └── uganda-finance-technical-architecture.md
├── lib/
│   ├── data.ts
│   └── types.ts
├── public/
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Frontend Architecture

### App Shell

The initial app uses a single landing/dashboard page to communicate the product structure and serve as the basis for feature implementation.

Planned page groups for future build-out:

- `/` home/dashboard
- `/transactions`
- `/accounts`
- `/goals`
- `/investment-compass`
- `/learn`

### Component Principles

- keep components presentation-first where possible
- move financial rules into `lib/` instead of embedding them in JSX
- keep sections composable for later route extraction

### Styling Direction

- mobile-first layout
- warm, trustworthy visual language
- light theme default
- clear spacing and readable typography
- CSS variables for colors and surfaces

## Domain Model

The shared TypeScript domain model should define the app's financial language early.

### `UserProfile`

Purpose:

- represents core user preferences and money context

Fields:

- `id`
- `displayName`
- `currency`
- `salaryCycle`
- `primaryIncomeType`
- `riskComfort`
- `investmentHorizonMonths`

### `Account`

Purpose:

- models money stores and liabilities

Fields:

- `id`
- `name`
- `type`
- `institutionName`
- `balance`
- `notes`

### `Transaction`

Purpose:

- models money movement

Fields:

- `id`
- `accountId`
- `type`
- `direction`
- `amount`
- `occurredOn`
- `categoryId`
- `note`
- `transferGroupId`

### `Category`

Purpose:

- classifies transactions into reporting buckets

Fields:

- `id`
- `name`
- `kind`
- `isDefault`

### `Goal`

Purpose:

- models savings and wealth objectives

Fields:

- `id`
- `name`
- `goalType`
- `targetAmount`
- `currentAmount`
- `targetDate`
- `priority`
- `linkedAccountId`

### `InvestmentProfile`

Purpose:

- drives rule-based investment guidance

Fields:

- `id`
- `liquidityNeed`
- `riskComfort`
- `timeHorizonMonths`
- `goalFocus`

### `ResourceLink`

Purpose:

- stores curated education links and source references

Fields:

- `id`
- `title`
- `sourceName`
- `url`
- `topic`
- `isOfficial`

## Finance Logic Boundaries

The following logic should live in isolated functions or modules rather than UI components:

- account balance aggregation
- month summary calculations
- goal contribution math
- savings rate calculations
- transfer filtering
- investment guidance mapping based on horizon and liquidity

This separation will make unit testing easier and reduce coupling.

## Data Persistence Strategy

### Scaffold Phase

Use mock domain data in `lib/data.ts` to support UI development and documentation.

### MVP Build Phase

Introduce a persistence abstraction with interfaces such as:

- `UserRepository`
- `AccountRepository`
- `TransactionRepository`
- `GoalRepository`
- `ResourceRepository`

This allows:

- local storage or IndexedDB for prototype mode
- future migration to server-backed APIs

### Post-MVP Upgrade Path

- add authenticated users
- store data in Postgres
- use API routes or server actions for persistence
- add import job processing if CSV workflows become more complex

## CSV Import Design

CSV import should be implemented in layers:

1. file upload and parsing
2. column mapping
3. row normalization
4. duplicate detection
5. import confirmation
6. uncategorized row review

Initial parser expectations:

- UTF-8 CSV only
- one row per transaction
- one amount field or credit/debit pair
- user-provided date mapping

The UI should never auto-import without preview and confirmation.

## Investment Guidance Engine

The Investment Compass should be implemented as a deterministic rule engine, not an LLM-generated advisory system.

Inputs:

- time horizon
- liquidity need
- emergency fund status
- high-cost debt flag
- risk comfort
- goal type

Outputs:

- recommended product classes
- warnings
- educational notes
- official resource links

Rules example:

- if `timeHorizonMonths < 12`, recommend cash-like options only
- if `highCostDebt = true`, prioritize debt reduction guidance
- if `emergencyFundMonths < threshold`, show emergency fund prompt before growth investing

## API and Interface Direction

The scaffold does not need live APIs yet, but the architecture should assume future interfaces.

Potential internal service interfaces:

```ts
type MonthSummary = {
  inflow: number;
  outflow: number;
  savings: number;
  transfers: number;
  net: number;
};

interface SummaryService {
  getMonthSummary(userId: string, month: string): Promise<MonthSummary>;
}

interface GuidanceService {
  getInvestmentGuidance(profile: InvestmentProfile): Promise<GuidanceResult>;
}
```

## Security and Privacy Notes

- avoid collecting unnecessary sensitive data in v1
- be explicit that the app does not execute investments
- clearly label external resources and institution links
- support future encryption and authenticated storage if user data becomes server-backed

## Testing Strategy

### Unit Tests

- month summary calculations
- transfer exclusion logic
- goal monthly contribution logic
- investment guidance rules

### Component Tests

- dashboard card rendering
- milestone rendering
- feature grid rendering

### End-to-End Tests

- onboarding flow
- add account flow
- add transaction flow
- create goal flow
- import preview flow

## Milestone Implementation Sequence

1. establish scaffold and domain types
2. build static dashboard sections using mock data
3. implement local form state for transactions and goals
4. add summary and guidance utilities
5. introduce persistence abstraction
6. layer in tests

## Technical Risks

- premature backend complexity may slow early product learning
- import logic may expand quickly if statement formats vary
- guidance logic must remain deterministic and explainable
- route structure may evolve as dashboard sections become full pages

## Recommendation

Build the first engineering pass as a clean, typed frontend scaffold with domain models, mock data, and modular UI sections. That keeps momentum high while preserving a strong path toward persistence, testing, and feature expansion.