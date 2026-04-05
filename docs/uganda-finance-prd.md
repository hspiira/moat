# Uganda Finance App PRD

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Draft |
| Owner | TBD |
| Last Updated | 2026-04-05 |
| Based On | `docs/uganda-finance-mvp-blueprint.md` |

## Product Summary

The Uganda Finance App is a mobile-first personal finance product built for young salaried Ugandans with occasional side income. It helps users track spending, understand monthly cash flow, build savings habits, and choose safer long-term money paths without relying on fragile financial integrations in v1.

The product is built around three user jobs:

- track where money comes from and where it goes
- decide what each shilling should do next
- build habits that create resilience over time

## Problem

Young professionals in Uganda often manage money across salary accounts, mobile money, cash, SACCOs, and informal obligations. Existing finance products usually assume card-heavy digital histories and predictable financial behavior, which makes them a poor fit for many local users.

Users need a product that helps them:

- capture fragmented money activity
- separate spending from transfers and savings
- tie financial behavior to real goals
- understand safe investment pathways in Uganda

## Primary User

The first release is optimized for a young salaried Ugandan who:

- receives regular salary through a bank account
- spends using cash and mobile money
- supports family or dependents occasionally
- wants to build emergency savings
- is curious about investing but unsure where to start

## Product Goals

### Business Goals

- establish a credible Uganda-first personal finance foundation
- validate that manual and CSV-based money tracking can drive recurring use
- create a roadmap-ready base for future automation and integrations

### User Goals

- know monthly inflow, outflow, and savings rate
- identify top spending categories and leak areas
- create and fund concrete goals
- understand what type of investment path fits a goal horizon

### Non-Goals

- direct trade execution
- mobile money sync in v1
- bank sync in v1
- tax filing
- business accounting
- personalized investment advice

## Success Metrics

### Activation Metrics

- 70% of new users complete onboarding
- 60% of onboarded users create at least 2 accounts
- 50% of onboarded users log or import at least 10 transactions in the first week

### Engagement Metrics

- 40% of activated users return weekly in month one
- 35% of activated users create at least one goal
- 25% of activated users review the Investment Compass

### Outcome Metrics

- users can identify their top 3 spending categories in under 30 seconds
- users can explain their monthly savings target after using the app
- users understand whether a goal belongs in cash-like savings or long-term investing

## Core User Stories

### Onboarding

- As a new user, I want to set up my money profile in a few minutes so I can start with a useful dashboard immediately.
- As a new user, I want my default categories to reflect Uganda spending realities so the app feels relevant from day one.

### Accounts

- As a user, I want to create cash, mobile money, bank, SACCO, and debt accounts so I can see my full financial picture.

### Transactions

- As a user, I want to log expenses and income quickly so the app stays useful even without bank integrations.
- As a user, I want transfers between my own accounts not to look like spending.

### Import

- As a user, I want to import a CSV statement and map fields so I can avoid re-entering months of activity manually.

### Insights

- As a user, I want a monthly dashboard so I can understand if I am progressing or drifting.

### Goals

- As a user, I want to create a goal like emergency fund or land savings so I can connect saving behavior to something meaningful.

### Investment Guidance

- As a user, I want simple, safe, local guidance so I can know where to start without hype or scams.

## Feature Requirements

## 1. Onboarding

### Requirements

- collect name or nickname
- collect primary income type
- collect salary cycle
- collect account types user wants to track
- collect top goals
- collect basic investment horizon and liquidity preference

### Acceptance Criteria

- user can complete onboarding in one flow
- user lands on a populated dashboard state after onboarding
- local default categories are created automatically

## 2. Accounts

### Requirements

- support account creation and editing
- support cash, mobile money, bank, SACCO, investment, and debt account types
- allow manual balance initialization

### Acceptance Criteria

- user can create at least one account of each supported type
- accounts appear in aggregate balance summaries

## 3. Transactions

### Requirements

- support manual income, expense, transfer, savings, and debt-payment entries
- support notes and categories
- support editing and deletion

### Acceptance Criteria

- transfers do not increase total spend
- categorized transactions update dashboard totals immediately

## 4. CSV Import

### Requirements

- upload CSV file
- preview rows before import
- allow column mapping
- mark uncertain rows for review

### Acceptance Criteria

- user can import a simple CSV using the documented template
- duplicate imports are detectable

## 5. Dashboard

### Requirements

- show total inflow, outflow, savings rate, and net position
- show top spending categories
- show account balances
- show monthly prompts

### Acceptance Criteria

- dashboard accurately reflects current month transaction totals
- transfer-only activity does not distort cash-flow reporting

## 6. Goals

### Requirements

- create a goal with amount and deadline
- calculate monthly contribution target
- update progress based on linked contributions

### Acceptance Criteria

- user can create emergency fund, rent buffer, and land savings goals
- goal progress updates after relevant transactions are added

## 7. Investment Compass

### Requirements

- ask or infer horizon, liquidity need, and risk comfort
- output suitable product classes, not product picks
- provide official local references

### Acceptance Criteria

- user with under-12-month goal is not steered into volatile products
- user sees warnings for scams, unverifiable schemes, and unsuitable risk

## 8. Learn Uganda

### Requirements

- curate official links and practical explainers
- group resources by saving, investing, verification, and financial basics

### Acceptance Criteria

- every resource has a title, source, and destination link
- official or licensed sources are clearly marked

## User Experience Principles

- first screen must communicate clarity and control
- forms should be short and forgiving
- money language should stay plain and practical
- insights should sound helpful, not judgmental
- visual hierarchy should prioritize action over decoration

## Release Scope

### MVP Includes

- onboarding
- accounts
- manual transactions
- CSV import
- dashboard
- goals
- Investment Compass
- Learn Uganda

### MVP Excludes

- authentication beyond a basic local or starter implementation
- multi-device sync unless added later in architecture phase
- advisor-like recommendations
- automated institution verification

## Dependencies

- product content and regulatory copy review
- official local resource curation
- final schema and storage design
- UI wireframes for primary flows

## Risks

- users may expect bank sync immediately
- category defaults may need iteration after pilot use
- investment language may need legal/compliance refinement
- CSV import may be more complex across statement sources than expected

## Launch Readiness Checklist

- onboarding is stable
- category taxonomy is finalized for v1
- dashboard calculations are correct
- goal math is correct
- investment guidance respects product guardrails
- source links are valid and reviewed
- core app works well on mobile screen sizes

## Open Decisions For Follow-Up

- auth model for first release
- whether data is local-first, server-backed, or hybrid in alpha
- whether users can attach a goal to a specific account in v1 UI
- whether reminders are in-app only or also push/email later
