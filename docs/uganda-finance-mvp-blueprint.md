# Uganda Finance App MVP Blueprint


| Field            | Value                              |
| ---------------- | ---------------------------------- |
| Document Version | 1.0                                |
| Status           | Draft foundation document          |
| Owner            | Piira                              |
| Last Updated     | 2026-04-05                         |
| Primary Market   | Uganda                             |
| Product Stage    | Pre-build / documentation baseline |


## Executive Summary

This document defines the first ground-up blueprint for a Uganda-first personal finance app designed to help users build a financial moat for their future selves. The product is not just a spending tracker. It is a personal money operating system that helps users understand where money comes from, where it goes, what they are building toward, and which safe investment paths fit their stage of life.

The first version is built for young salaried Ugandans who often live across multiple financial systems at once: salary through a bank account, daily spending through mobile money or cash, family obligations paid informally, and future wealth ambitions tied to land, SACCOs, farming, side businesses, Treasury instruments, unit trusts, and long-term savings. That mix is common in Uganda and is one reason many global personal finance products do not fit local realities.

This blueprint makes three decisions early:

- Start with manual entry and CSV import instead of complex financial integrations.
- Treat investing broadly, not only as stocks and mutual funds.
- Build trust through simple rules, education, and explainable guidance rather than hype or speculative tips.

The outcome of this document is a build-ready MVP plan covering problem framing, market context, target users, product objectives, feature scope, functional requirements, data model, implementation milestones, and acceptance criteria.

## Problem Statement

Personal finance in Uganda is difficult because money management is fragmented across formal and informal systems. A user may receive salary in a bank account, withdraw some cash, pay transport with mobile money, contribute to a SACCO, support family members, save at home for emergencies, and aspire to invest in land or a side business. Those flows rarely live in one clean digital record.

Existing finance apps often assume:

- stable monthly salary only
- card-heavy spending patterns
- deep bank integrations
- predictable subscriptions
- investment access mainly through listed securities

Those assumptions do not fit many Ugandan users. In Uganda, income can be mixed and uneven, mobile money is central, informal savings remain common, and investment goals often include land, farming, business capital, and education alongside regulated financial products.

As a result, many users face the same core problems:

- They do not have a full picture of their monthly cash flow.
- They struggle to distinguish true spending from transfers or goal-based saving.
- They save inconsistently because savings are not connected to clear goals.
- They are exposed to poor financial decisions, scams, or unsuitable investment ideas.
- They lack a simple way to move from tracking money to building long-term security.

This app exists to solve that gap. It combines spending visibility, goal-based savings, and safe investment guidance into one system that reflects how money actually works in Uganda.

## Uganda Market Context

### How People Commonly Earn Money

Uganda has a mixed-income economy where salaried work is important but not dominant. FinScope Uganda 2023 shows that many adults still rely on trading and selling as a main source of income, while wages, salaries, and service-based work have increased in importance over time. This matters because even a "salaried" user may also earn money from occasional side hustles, freelance work, commissions, transport, resale, or family-linked microbusiness activity.

For this product, that means the app must support:

- primary salary income
- side income or occasional earnings
- irregular bonus or commission income
- transfers and support received from family
- income from rent, interest, or small asset-based activity

### How People Hold and Move Money

Ugandan money movement is rarely limited to one channel. Users commonly operate across:

- cash
- mobile money wallets
- bank accounts
- SACCO accounts
- informal group savings systems

Mobile money is especially important for day-to-day transfers and payments, while bank accounts may be more closely associated with salary receipt, formal saving, or larger transfers. FinScope Uganda 2023 also indicates continued reliance on informal storage of money, including money kept at home, which suggests persistent trust and accessibility gaps across financial service options.

For product design, this means the system cannot assume:

- a single "main account"
- perfect digital transaction history
- always-on bank connectivity
- users who separate spending, saving, and investing cleanly

### How People Save and Invest

In Uganda, wealth-building is broader than market investing. Many users aspire to build financial security through:

- emergency cash reserves
- SACCO participation
- land acquisition
- farming and agribusiness
- side businesses
- housing or construction
- education savings
- Treasury bills and bonds
- collective investment schemes or unit trusts
- retirement products and pensions

FinScope Uganda 2023 shows that land, farming, and business remain prominent investment aspirations. At the same time, regulated investment pathways exist through institutions such as the Bank of Uganda, Uganda Securities Exchange, Capital Markets Authority, and Uganda Retirement Benefits Regulatory Authority. The app should therefore classify investment options in terms that match user goals and time horizons, rather than defaulting to stock-picking language.

### Design Constraints Shaped by Local Reality

The product must assume the following local constraints:

- Income can be irregular even for target users with formal jobs.
- Spending is split across cash, mobile money, and bank transfers.
- Users often support extended family or dependents.
- Trust is earned slowly; users may prefer manual control before automation.
- Financial literacy levels differ widely.
- Saving and investing decisions are often driven by concrete goals, not abstract portfolio logic.

### Key Uganda Sources

- [FinScope Uganda 2023 survey summary](https://fsduganda.or.ug/wp-content/uploads/2024/04/FinScope-Uganda-2023-Findings-Summary.pdf)
- [Uganda Bureau of Statistics](https://www.ubos.org/)
- [Bank of Uganda bills and bonds calendar](https://bou.or.ug/bouwebsite/FinancialMarkets/billsandbonds.html)
- [Uganda Securities Exchange](https://use.or.ug/)
- [Capital Markets Authority Uganda](https://cmauganda.co.ug/)
- [Uganda Microfinance Regulatory Authority](https://umra.go.ug/)
- [Uganda Retirement Benefits Regulatory Authority](https://www.urbra.go.ug/)

## Target User Definition

### Primary Persona

The primary user for MVP is a young salaried Ugandan, usually urban or peri-urban, between roughly 22 and 35 years old, who has a monthly salary but may also have occasional side income.

Typical profile:

- receives salary through a bank account
- spends through cash and mobile money
- pays rent, transport, data, food, and utilities monthly
- helps family financially when needed
- wants to save but lacks consistency
- wants to invest but is unsure where to start safely
- worries about emergencies, future stability, and missing opportunities

### Secondary Personas for Later Phases

The following users matter but are not the initial MVP focus:

- self-employed hustlers with highly irregular income
- small business owners mixing personal and business cash flows
- SACCO-heavy rural savers
- multi-person households needing shared planning

These groups can be addressed later after the core framework is validated with the primary persona.

### Main Pains, Behaviors, Motivations, and Fears

Pains:

- "I know money comes in, but I do not know where it disappears."
- "I save sometimes, but not in a structured way."
- "I hear about investment opportunities, but I do not know what is legitimate."
- "I can manage this month, but I am not building security for next year."

Behaviors:

- uses mobile money often
- mixes mental budgeting with real-world improvisation
- tracks expenses inconsistently
- thinks in terms of goals like rent, land, or business
- may keep part of savings outside formal institutions

Motivations:

- reduce financial stress
- build emergency reserves
- gain confidence
- support family without collapsing personal stability
- start investing with discipline

Fears:

- scams and fake opportunities
- locking money into the wrong place
- market losses on short-term money
- unexpected emergencies
- losing track of obligations

## Product Vision

The app should function as a personal money operating system for Uganda.

Its core promise is simple:

- `Track` what money is doing.
- `Decide` what each shilling should do next.
- `Automate` habits and reminders once the user trusts the system.

Building a financial moat means helping users create buffers and durable financial positioning over time. In product terms, that means:

- understanding spending clearly
- building emergency savings before taking unnecessary risk
- routing money into goals on purpose
- separating short-term needs from long-term wealth building
- using safe, regulated, and suitable investment pathways where possible

The vision is not to impress users with complexity. It is to help them become calmer, more deliberate, and more resilient with money.

## Objectives and Success Criteria

### Product Objectives

The MVP should help users:

1. Understand where their money comes from and where it goes.
2. Build consistent savings behavior around real goals.
3. Create or strengthen an emergency fund.
4. Distinguish between short-term money, long-term money, and investment money.
5. Learn which regulated investment paths are worth considering in Uganda.

### MVP Success Criteria

The MVP is successful if early users can:

- complete onboarding and account setup in under 5 minutes
- record or import enough data to view a useful monthly cash-flow summary
- identify their top spending categories for the month
- set at least one goal and understand the required monthly contribution
- receive understandable, rule-based investment guidance aligned to their time horizon
- return to the app at least weekly during the first month of use

Suggested product metrics for pilot phase:

- onboarding completion rate
- weekly active users
- percentage of users logging 10 or more transactions in month one
- percentage of users creating at least one goal
- percentage of users reaching first emergency-fund milestone
- percentage of users opening the Investment Compass or Learn Uganda section

## Product Principles

- **Uganda-first:** The app should start from local money behavior, not imported assumptions.
- **Mobile-first:** The default experience should work well on phones before desktop.
- **Trust-first:** The app must feel safe, understandable, and non-pushy.
- **Manual-first before automation:** MVP should prioritize reliability and control over fragile integrations.
- **Goal-based over category-only:** Spending analysis should always connect to what the user is trying to build.
- **Education-led investing:** The product should explain options and tradeoffs rather than push speculation.
- **Explainability over cleverness:** Every recommendation should be understandable in plain language.
- **Liquidity awareness:** Users should not be nudged into long-term products with short-term money.

## Scope Definition

### In Scope for MVP

- single-user personal finance profile
- manual account setup
- manual transaction entry
- CSV transaction import
- category-based spending analysis
- budget and monthly cash-flow dashboard
- goal tracking
- emergency-fund planning
- investment guidance engine based on rules
- Uganda-specific learning/resources section
- monthly action prompts and simple reminders

### Explicitly Out of Scope for MVP

- direct bank integration
- direct mobile money integration
- portfolio execution or trade placement
- personalized stock recommendations
- family or team accounts
- business bookkeeping
- tax reporting
- loan underwriting
- advanced AI financial advice

### Phase 2 or Later

- bank and mobile money integrations
- smarter category suggestions
- recurring transaction detection
- debt payoff planner with scenario tools
- institution verification workflows
- household planning
- business/personal split for founders
- in-app connection to licensed providers where legally appropriate

## MVP Feature Specification

### 1. Onboarding

The user should be able to set up the app quickly with local relevance.

Required onboarding fields:

- name or nickname
- primary income type
- salary cycle
- primary spending channels
- current savings style
- emergency-fund status
- top financial goals
- investment horizon

Expected onboarding output:

- starter dashboard
- default categories
- first goal recommendation
- initial Investment Compass profile

### 2. Accounts

Users should manually create and manage accounts across the ways they actually store money.

Supported account types:

- cash
- mobile money
- bank account
- SACCO
- investment account
- debt or obligation account

Each account should support:

- account name
- account type
- opening balance
- current balance
- notes
- optional institution name

### 3. Transactions

Users should be able to add transactions manually in a way that feels natural and fast.

Transaction types:

- income
- expense
- transfer
- savings contribution
- debt payment

Required transaction fields:

- date
- amount
- account
- transaction type
- category
- note

Recommended local default categories:

- rent
- food
- transport / boda
- airtime / data
- utilities
- mobile money charges
- family support
- school fees
- health
- church / giving
- savings
- investments
- debt repayment
- business top-up
- entertainment
- clothing / personal care

### 4. CSV Import

CSV import should be the main scale mechanism for bringing in historical data during MVP.

Requirements:

- support a documented template
- allow column mapping
- preview before import
- detect likely duplicates
- classify obvious transfers when possible
- surface uncategorized rows for review

The first version should optimize for practicality rather than universal parser coverage.

### 5. Budget and Spending Analytics

The dashboard should convert raw transaction data into useful monthly insight.

Key views:

- total inflow
- total outflow
- net cash flow
- top spending categories
- fixed vs variable spending
- savings rate
- account balances

The dashboard should also highlight:

- overspending categories
- monthly leak areas
- transfer-adjusted spending

### 6. Goals and Emergency Fund Tracking

Users should be able to create concrete goals and understand the contribution needed to reach them.

Goal types:

- emergency fund
- rent buffer
- school fees
- land savings
- business capital
- travel
- device purchase
- education
- house / construction

Each goal should have:

- target amount
- target date
- linked account or funding bucket
- monthly contribution target
- progress percentage

Emergency fund logic should be privileged in the interface and presented before higher-risk investing suggestions.

### 7. Investment Compass

This module should guide users toward suitable product classes based on time horizon, liquidity needs, and risk comfort.

The MVP should present:

- a simple profile summary
- suggested product classes
- warnings and caveats
- links to official Uganda-first educational resources

Supported guidance categories:

- cash and bank savings
- SACCO savings
- Treasury bills / bonds
- collective investment schemes / unit trusts
- pensions / retirement products
- land and business capital as non-market wealth goals

This module must never:

- promise returns
- recommend speculative or unverified schemes
- present personalized security picks

### 8. Learn Uganda Resource Center

This section should aggregate trusted, practical, local reference material.

Content buckets:

- how Ugandans earn and spend
- how to save safely
- what regulated investment products exist
- how to verify financial institutions
- basic financial literacy explainers

Preferred source families:

- UBOS
- FinScope / FSD Uganda
- Bank of Uganda
- Uganda Securities Exchange
- Capital Markets Authority
- UMRA
- URBRA

### 9. Monthly Action Prompts

Each month, the app should present a short list of next steps.

Examples:

- "Your transport spend rose this month; review boda usage."
- "You are behind on your emergency fund target by UGX X."
- "You transferred money often between mobile money and bank; make sure transfers are not counted as spending."
- "Your goal horizon is short, so keep this money in cash-like products."

## Functional Requirements

### Module Behaviors

Onboarding:

- must create a usable starter state in one session
- must assign sensible local default categories

Accounts:

- must support multiple accounts of different types
- must allow balances to be updated without complex setup

Transactions:

- must distinguish transfers from spending
- must allow later editing and recategorization

CSV Import:

- must let users map incoming columns
- must not silently duplicate data

Budgeting:

- must summarize by month
- must separate inflows, outflows, savings, and transfers

Goals:

- must compute monthly required contributions
- must update progress as linked transactions occur

Investment Compass:

- must use explainable rules
- must always respect time horizon and liquidity needs

Resource Center:

- must link to trustworthy Uganda-relevant sources

### Input and Output Expectations

Inputs:

- manual account creation
- manual transaction entry
- CSV uploads
- user-stated goals and preferences

Outputs:

- monthly cash-flow summary
- category breakdown
- goal contribution recommendation
- emergency-fund status
- investment pathway guidance
- educational links and warnings

### Default Local Presets

- currency: `UGX`
- month-based reporting by default
- salary cycle preset: month end
- transport category includes boda and taxi
- communication category includes airtime and data
- giving category supports church/tithe and family support
- account presets include cash, mobile money, bank, and SACCO

### Decision Rules Around Savings and Investing

- emergency-fund guidance appears before long-term investing guidance
- high-cost debt, if tracked, should be flagged before growth investing
- goals under 12 months should default to cash-like or low-volatility suggestions
- goals from 1 to 3 years should emphasize stability and capital preservation
- goals over 3 years can surface diversified regulated products
- land or business goals should be treated as valid wealth-building objectives, not ignored because they are non-market

## Non-Functional Requirements

- **Simplicity:** the product should avoid jargon-heavy flows
- **Explainability:** every recommendation should have a plain-language reason
- **Low data-entry friction:** adding a transaction should take seconds
- **Mobile usability:** core flows should be comfortable on lower-end phones
- **Offline-tolerant thinking:** the design should degrade gracefully with weak connectivity
- **Privacy and trust:** users must feel safe recording financial details
- **Performance:** core dashboard views should load quickly even with several months of records
- **Extensibility:** the data model should support future integrations without rewriting the MVP foundation

## Data Model Overview

### `User`

Represents the individual account owner and product preferences.

Key fields:

- `id`
- `display_name`
- `currency`
- `salary_cycle`
- `primary_income_type`
- `risk_comfort`
- `created_at`

### `Account`

Represents a place where money is stored, moved through, or owed.

Key fields:

- `id`
- `user_id`
- `name`
- `type`
- `institution_name`
- `opening_balance`
- `current_balance`
- `is_active`

### `Transaction`

Represents all money movement events.

Key fields:

- `id`
- `user_id`
- `account_id`
- `date`
- `amount`
- `direction`
- `transaction_type`
- `category_id`
- `note`
- `transfer_group_id`
- `import_batch_id`

### `Category`

Represents spending, income, or savings classification.

Key fields:

- `id`
- `user_id`
- `name`
- `kind`
- `is_default`

### `Budget`

Represents monthly planning or spending targets.

Key fields:

- `id`
- `user_id`
- `month`
- `category_id`
- `target_amount`

### `Goal`

Represents a financial objective with a target amount and target date.

Key fields:

- `id`
- `user_id`
- `name`
- `goal_type`
- `target_amount`
- `target_date`
- `current_amount`
- `linked_account_id`
- `priority`

### `InvestmentProfile`

Represents user preferences and guardrails for investment guidance.

Key fields:

- `id`
- `user_id`
- `time_horizon`
- `liquidity_need`
- `risk_comfort`
- `preferred_goal_type`
- `guidance_level`

### `InsightItem`

Represents generated insights or monthly prompt cards.

Key fields:

- `id`
- `user_id`
- `kind`
- `title`
- `body`
- `month`
- `priority`

### `ResourceLink`

Represents curated learning resources and official external references.

Key fields:

- `id`
- `title`
- `source_name`
- `url`
- `topic`
- `market`
- `is_official`

## User Flows

### New User Setup

1. User opens app.
2. User selects core money channels and salary rhythm.
3. User enters current balances for main accounts.
4. User selects key goals.
5. App generates starter dashboard and first recommendations.

### Add Account

1. User taps add account.
2. User chooses account type.
3. User enters name and opening balance.
4. Account appears in balance summary.

### Record Transaction

1. User chooses account.
2. User enters amount and type.
3. User selects category.
4. Transaction updates dashboard and goal progress if relevant.

### Import Statement

1. User uploads CSV.
2. User maps columns.
3. User previews rows.
4. App flags duplicates and uncertain rows.
5. User confirms import.
6. Dashboard recalculates totals.

### Review Monthly Spending

1. User opens dashboard.
2. User views inflow, outflow, savings rate, and top categories.
3. App highlights leak areas and useful prompts.

### Set Goal

1. User chooses goal type.
2. User enters target amount and date.
3. App calculates monthly contribution requirement.
4. Goal appears on home screen.

### View Investment Guidance

1. User opens Investment Compass.
2. App evaluates horizon, liquidity need, and existing emergency-fund progress.
3. User sees suitable product classes, cautions, and official links.

## Investment Framework

### Allowed Guidance Boundaries

The app may:

- explain product categories
- map products to time horizon and liquidity need
- encourage diversification and regulated pathways
- direct users to official sources and licensed institutions

The app may not:

- give individualized security picks
- promise performance
- imply guaranteed outcomes
- route users into unregulated or unverifiable schemes

### Regulated Product Categories to Surface

- bank savings products
- licensed SACCO savings
- Treasury bills
- Treasury bonds
- licensed collective investment schemes / unit trusts
- pensions and retirement savings products

### Time-Horizon Rules

- under 12 months: emphasize liquidity and capital stability
- 1 to 3 years: favor low-volatility, lower-risk options
- 3 years and above: introduce diversified regulated long-term products

### Debt-First and Emergency-Fund-First Logic

- if the user lacks a basic emergency fund, the app should recommend building that first
- if the user tracks high-cost debt, the app should flag debt reduction before higher-risk investing
- long-term investing prompts should be softer when short-term instability is obvious

### Scam and Suitability Warnings

The app should explicitly caution against:

- unrealistic return promises
- schemes that cannot be verified through official or licensed channels
- putting rent, fees, or emergency cash into volatile products

## Milestones and Roadmap

### Milestone 1: Research and Documentation Baseline

Goal:

- establish product thesis, local context, and implementation direction

Outputs:

- this blueprint
- source list for Uganda finance context
- initial product assumptions

Completion criteria:

- document is understandable by product, design, and engineering contributors
- MVP boundaries are explicit
- local market assumptions are clearly stated

### Milestone 2: Product Design and Data Model

Goal:

- translate this blueprint into UX flows, information architecture, and technical schema

Outputs:

- wireframes for core screens
- category taxonomy
- data schema draft
- CSV import behavior spec

Completion criteria:

- all core user flows are mapped
- schema supports MVP features without ambiguity
- design and engineering agree on feature behavior

### Milestone 3: MVP Build

Goal:

- implement the first usable end-to-end version

Outputs:

- onboarding flow
- accounts module
- transactions module
- dashboard
- goals
- Investment Compass
- Learn Uganda content layer

Completion criteria:

- a user can onboard, record money activity, create a goal, and view guidance
- dashboards reflect data correctly
- no critical ambiguity remains in core flows

### Milestone 4: Internal Testing and Iteration

Goal:

- validate correctness, usability, and clarity before pilot release

Outputs:

- QA checklist
- bug list
- revised content and copy
- clearer prompts and categories

Completion criteria:

- team can complete primary flows without confusion
- category logic and transfer logic work reliably
- investment guidance language passes trust and compliance review

### Milestone 5: Pilot With First Ugandan Users

Goal:

- gather real usage feedback from early target users

Outputs:

- pilot cohort feedback
- retention and usage data
- prioritized next-phase roadmap

Completion criteria:

- pilot users can maintain records over several weeks
- users understand the value of goals and emergency-fund tracking
- evidence exists on whether automation or manual flows should be prioritized next

## Risks and Open Questions

- **Data import quality:** bank and wallet exports may vary widely in format and cleanliness.
- **User trust:** users may hesitate to record financial details unless the value is obvious immediately.
- **Institution verification:** the app must not accidentally normalize unlicensed schemes.
- **Advice boundary:** wording must remain educational and guidance-based, not regulated advisory.
- **Integration uncertainty:** mobile money and bank sync may remain difficult, fragmented, or expensive.
- **Category fit:** local categories may need rapid iteration after real user testing.
- **Balance reconciliation:** users may need a future way to correct drift between recorded and actual balances.

## Acceptance Criteria

This documentation is implementation-ready when all of the following are true:

- a new contributor can understand the product without external explanation
- the problem statement is grounded in Uganda-specific reality
- the target audience and MVP scope are explicit
- the feature set is concrete enough to drive design and engineering work
- investment boundaries and compliance guardrails are clearly stated
- milestones define outputs and completion criteria
- the data model provides enough structure for a technical design follow-up
- the next build steps are obvious from reading the document

## Appendix

### Key Uganda References

- [FinScope Uganda 2023 survey page](https://fsduganda.or.ug/finscope-uganda-2023-survey/)
- [FinScope Uganda 2023 findings summary PDF](https://fsduganda.or.ug/wp-content/uploads/2024/04/FinScope-Uganda-2023-Findings-Summary.pdf)
- [Uganda Bureau of Statistics](https://www.ubos.org/)
- [Bank of Uganda bills and bonds calendar](https://bou.or.ug/bouwebsite/FinancialMarkets/billsandbonds.html)
- [Uganda Securities Exchange](https://use.or.ug/)
- [Capital Markets Authority Uganda](https://cmauganda.co.ug/)
- [Uganda Microfinance Regulatory Authority](https://umra.go.ug/)
- [Uganda Retirement Benefits Regulatory Authority](https://www.urbra.go.ug/)

### Glossary of Local Finance Terms

- **Mobile money:** wallet-based digital money service commonly used for transfers, payments, and cash movement.
- **SACCO:** savings and credit cooperative organization used for savings and loans.
- **Boda:** motorcycle transport commonly used in Uganda and a meaningful recurring spending category.
- **Airtime/data:** prepaid phone credit and internet bundle spending, often a distinct monthly expense.
- **Goal bucket:** a planned savings target for a specific purpose.
- **Financial moat:** the personal financial buffers and assets that make a user more resilient over time.

### Suggested Future Expansion Areas

- bank and mobile money sync
- shared family planning tools
- debt management scenarios
- automated recurring income and expense detection
- institution verification workflows
- provider partnerships with licensed financial institutions
- small-business mode for mixed personal and business finances

## Next Steps

The next documentation and product work should proceed in this order:

1. Create a product requirements document that turns this blueprint into screen-level behavior and acceptance criteria.
2. Draft the technical design with proposed stack, schema, API surface, and sync model.
3. Design low-fidelity wireframes for onboarding, dashboard, transactions, goals, Investment Compass, and Learn Uganda.
4. Define the first CSV import template and field mapping rules.
5. Establish a compliance/content review checklist for all investment-related guidance copy.

