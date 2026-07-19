# Moat — Open Strategy Questions

| Field | Value |
|-------|-------|
| Status | Active |
| Owner | Piira |
| Last updated | 2026-07-19 |

This document holds the **product and business questions** that are not yet answered anywhere in the codebase or the other docs. Engineering-side open work lives in [../tracker.md](../tracker.md); this is deliberately separate because these need product/founder decisions, not implementation.

Each item states the question, why it matters, what exists today, and a suggested next step. None of these block the current local-first pilot, but they block scaling beyond it.

---

## 1. Monetization / business model

**Question:** How does Moat make money, and does that thesis shape the roadmap?

**Why it matters:** The roadmap contemplates a BoU sandbox, licensed fund-manager partnerships, USSD deals, and eventually a hosted backend — all of which have real cost. There is currently no revenue thesis to justify or prioritize them. Pricing also shapes core product decisions (e.g. is encrypted cloud sync a paid tier?).

**What exists today:** Nothing. The PRD's "Business Goals" are validation goals only ([prd.md](prd.md)).

**Suggested next step:** Write a one-page thesis covering candidate models (freemium sync, referral fees from licensed investment partners via the Compass, premium bookkeeping for salary-plus-side-hustle users) and pick one to validate in the pilot survey.

---

## 2. Distribution / go-to-market

**Question:** Beyond the <20-user pilot cohort, how do users discover and adopt Moat?

**Why it matters:** There is a defined pilot cohort but no acquisition strategy. WhatsApp appears only as a *capture* channel, never a *growth* channel. Play Store listing/ASO, referral loops, and partnership-led distribution are all unaddressed — and distribution constraints (e.g. Play policy on notification capture) already shape the native roadmap.

**What exists today:** Pilot cohort definition in [../tracker.md](../tracker.md) and [../testing/pilot-readiness.md](../testing/pilot-readiness.md). No growth plan.

**Suggested next step:** Decide the first post-pilot channel (organic WhatsApp/community, Play Store, or partner referral) and whether APK-direct vs Play Store distribution is the launch path, since that gates notification/SMS capabilities.

---

## 3. Analytics / instrumentation

**Question:** How are the PRD's success metrics actually measured?

**Why it matters:** The PRD defines concrete activation/engagement targets (70% onboarding completion, 60% with ≥2 accounts, 25% Compass review, etc.), but event instrumentation is explicitly deferred to "once the first pilot identifies bottlenecks." As written, these metrics have **no measurement mechanism** — they exist on paper only. A local-first, privacy-first product also needs an instrumentation approach that doesn't undermine its own privacy promise.

**What exists today:** Metric definitions in [prd.md](prd.md). No analytics code, no event pipeline.

**Suggested next step:** Decide a privacy-respecting measurement approach for the pilot (e.g. local event log the user can inspect and optionally share, or a minimal consented telemetry endpoint) so activation/engagement can be observed at all.

---

## 4. PDPO registration ownership

**Question:** Who owns Data Protection and Privacy Office (PDPO) registration under Uganda's DPPA 2019, and is it required before the pilot?

**Why it matters:** The compliance research flags PDPO registration as a blocking legal task, but it is currently unowned and undated. A private pilot that collects real financial data may already trigger the obligation. This is a legal-exposure item, not an engineering one.

**What exists today:** Regulatory analysis and the DPPA 2019 obligations table in [../research/roadmap-and-opportunities.md](../research/roadmap-and-opportunities.md). Marked ⏳ (deferred, unowned) there.

**Suggested next step:** Assign an owner, confirm with counsel whether a <20-user private pilot requires registration, and set a target date. Record the outcome in [../tracker.md](../tracker.md) Open Decisions.

---

## 5. "Learn Uganda" content governance

**Question:** Who sources, reviews, and maintains the financial-education and investment resources, and under what legal/licensing basis?

**Why it matters:** The Compass and Learn routes surface official and third-party resources. Linking to or summarizing regulated financial content carries accuracy and liability obligations, and stale/broken links erode trust. Content governance is currently unassigned.

**What exists today:** Resources are seeded in code and grouped by topic; the governance gap is noted in [../research/roadmap-and-opportunities.md](../research/roadmap-and-opportunities.md). Source-link spot-checking is a pilot gate in [../testing/pilot-readiness.md](../testing/pilot-readiness.md).

**Suggested next step:** Assign a content owner and define a lightweight review cadence (source verification, "guidance not advice" copy review) before pilot.
