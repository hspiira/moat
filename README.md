# Uganda Finance App

Uganda-first personal finance app scaffold focused on spending visibility, goal-based savings, and safe investment guidance.

## What is here

- foundational product blueprint in [`docs/uganda-finance-mvp-blueprint.md`](./docs/uganda-finance-mvp-blueprint.md)
- PRD in [`docs/uganda-finance-prd.md`](./docs/uganda-finance-prd.md)
- technical architecture in [`docs/uganda-finance-technical-architecture.md`](./docs/uganda-finance-technical-architecture.md)
- a lightweight Next.js scaffold for the future product UI

## Current status

This repository is at the foundation stage. The docs define the product, the routed app shell provides stable implementation surfaces, and the domain layer now includes shared models, financial calculations, bootstrap defaults, and IndexedDB-backed repository interfaces.

## Suggested next steps

1. install dependencies with `npm install`
2. run the app with `npm run dev`
3. build onboarding and account setup on top of the routed shell
4. wire forms into the repository layer instead of storing state directly in route components
5. implement transactions, CSV import, and dashboard logic against the shared domain modules
