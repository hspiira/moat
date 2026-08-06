# Moat — Visual Reset (PIN, dashboard, navigation, PWA)

| Field | Value |
| --- | --- |
| Document Version | 1.0 |
| Status | Approved design |
| Owner | Piira |
| Last Updated | 2026-08-06 |
| Scope | Design-system foundation + lock screen, dashboard, mobile navigation, PWA layer |
| Out of scope | Rolling the new system across the remaining ~15 workspace routes (follow-up spec) |

## Goal

Replace Moat's warm parchment-and-teal identity with a dark-first monochrome system in
which **colour means money and nothing else**, and simplify the three screens a user
touches most: the lock screen, the dashboard, and the bottom navigation.

The driving constraint is legibility for a phone-first Ugandan audience, and a hard
accessibility requirement: **no meaning may be carried by hue alone.** The product owner
cannot reliably distinguish colours, and roughly 8% of male users share that constraint.
Every signal must survive being rendered in greyscale.

## Decisions taken

| Decision | Choice |
| --- | --- |
| Scope of change | Full visual reset |
| Theme strategy | Dark-first; light fully supported, same contrast bar |
| Colour allocation | Monochrome chrome; colour reserved for money semantics |
| Navigation | Floating capsule; icon-only idle, active item expands to a labelled pill |
| Lock screen | Biometric-first; keypad renders on demand |
| Dashboard | Nine blocks cut to five |
| PWA | Close asset/manifest gaps **and** drain the outbox via Background Sync |

---

## 1. Token system

### 1.1 The organising rule

The primary surface is always the inverse of the background: a white pill on near-black
in dark, a near-black pill on white in light. One rule, both themes, no brand accent to
maintain or keep accessible.

### 1.2 Neutral ramp

Dark (the design target):

| Token | Value | Role |
| --- | --- | --- |
| `--background` | `oklch(0.145 0 0)` | canvas |
| `--card` | `oklch(0.205 0 0)` | elevated panel |
| `--muted` | `oklch(0.269 0 0)` | inset / track |
| `--border` | `oklch(1 0 0 / 10%)` | hairline |
| `--foreground` | `oklch(0.985 0 0)` | primary text |
| `--muted-foreground` | `oklch(0.708 0 0)` | secondary text (7.4:1) |
| `--primary` | `oklch(0.985 0 0)` | pill / CTA / active nav |
| `--primary-foreground` | `oklch(0.205 0 0)` | text on primary |

Light (derived, rule inverted):

| Token | Value |
| --- | --- |
| `--background` | `oklch(0.985 0 0)` |
| `--card` | `oklch(1 0 0)` |
| `--muted` | `oklch(0.97 0 0)` |
| `--border` | `oklch(0.9 0 0)` |
| `--foreground` | `oklch(0.205 0 0)` |
| `--muted-foreground` | `oklch(0.5 0 0)` (5.8:1) |
| `--primary` | `oklch(0.205 0 0)` |
| `--primary-foreground` | `oklch(0.985 0 0)` |

### 1.3 Semantic colour — the only colour in the system

Three hues, each ≥45° from the others, and each separated in **lightness** so they remain
distinguishable with hue removed entirely.

| Token | Dark | Light | Meaning |
| --- | --- | --- | --- |
| `--pos` | `oklch(0.80 0.16 150)` | `oklch(0.55 0.14 150)` | money in |
| `--neg` | `oklch(0.65 0.19 25)` | `oklch(0.45 0.19 25)` | money out |
| `--clay` | `oklch(0.72 0.15 75)` | `oklch(0.50 0.13 75)` | needs attention |
| `--moat-ring-fill` | `oklch(0.72 0.13 200)` | `oklch(0.5 0.11 200)` | the moat ring |

`--pos` and `--neg` sit 0.15 apart in lightness, so in/out separate in greyscale.

This resolves a live defect: today `--primary` is `oklch(0.7 0.13 165)` and `--pos` is
`oklch(0.72 0.13 160)` in dark mode — "brand" and "you gained money" are the same colour.
The new system has no brand hue at all, so the collision cannot recur.

### 1.4 Redundancy requirement

Colour is reinforcement, never the signal.

- Every signed money figure renders a leading `+`/`−` or a direction glyph.
  `AmountIndicator` currently permits `sign="none"` on signed amounts; that becomes
  disallowed.
- Every error, warning and attention state pairs its colour with an icon.
- Charts distinguish series by position and direction, not fill alone.

### 1.5 Tokens retuned rather than removed

Investigation showed two tokens are load-bearing beyond decoration:

- `--accent` is baked into shadcn's select and menu primitives as a hover/focus surface.
  It is **retuned to a neutral**, which is what those primitives actually use it for.
- `--clay` carries "needs review / warning" across eight files. It is **retained as a
  third semantic** (attention) on its own hue rather than deleted.
- The six `--moat-surface-*` panel tints are **redefined to neutral elevation steps** in
  `globals.css`. This de-colours every panel app-wide from one place without touching ten
  call sites. The `tone` prop plumbing in `accent-card-header.tsx` and
  `accent-metric-card.tsx` is removed during the follow-up rollout, not here.

### 1.6 Shape and type

- `--radius`: `0.25rem` → `1rem`. Cards ~1.4rem; the nav capsule is fully round.
- Geist remains the UI face. Bricolage Grotesque is retained but narrowed to hero figures
  and screen titles — in a monochrome system typography carries the character, so the
  distinctive face earns its place at large sizes and gets out of the way at small ones.
- All money figures use `tabular-nums`.

---

## 2. Navigation

### 2.1 The capsule

A floating capsule replaces the full-width bottom bar: `rounded-full`, 56px tall,
`bg-card/80` with `backdrop-blur-xl` and a hairline border, centred, max-width ~22rem,
pinned at `bottom: calc(1rem + env(safe-area-inset-bottom))`.

Page content gains `padding-bottom: calc(5.5rem + env(safe-area-inset-bottom))` so nothing
is trapped beneath it. The desktop sidebar is unchanged.

### 2.2 Shape distinguishes the two filled elements

Two elements in the capsule are filled and high-contrast, so fill cannot tell them apart.
Shape does:

- **Active tab** — an elongated **pill** that always contains its word.
- **Capture** — a **circle** that never contains a word, only `+`.

Idle tabs are bare glyphs in `muted-foreground`. The pill animates its width between items,
which doubles as the "you moved" feedback. This satisfies the redundancy requirement in
§1.4: the active state is identifiable by shape and by the presence of a label, with fill
as reinforcement.

Destinations are unchanged: Home · Transactions · **+** · Accounts · More.

### 2.3 Top bar

Loses the "Moat" wordmark, which duplicates both the ring mark beside it and each page's
own title. Retains the mark, the lock button and More.

---

## 3. Lock screen

### 3.1 Biometric-first

When a passkey exists, the default screen is three elements: the ring mark, a status line,
and a "Use PIN instead" text button. The OS biometric sheet is already presented.

The keypad renders when: the user taps "Use PIN instead", biometric authentication fails or
is cancelled, a lockout is active, or no passkey is enrolled.

### 3.2 No layout shift

The keypad's space is reserved from first paint and it transitions in opacity only. A
keypad that pops in and shoves the dots upward is worse than one that was always present.

### 3.3 Preserved behaviour

All existing lock-screen behaviour survives the restyle: the ring-to-centre unlock glide,
the orbiting accent, the drain-and-refill lockout ring, digit reveal-then-mask,
hold-to-clear, hardware keyboard entry, and the reduced-motion bypass.

### 3.4 Restyle and one fix

Keys become `size-18 rounded-full` on `--muted`. PIN dots are filled/hollow, which is
already greyscale-safe.

**Fix:** the error line is currently colour-only (`text-destructive`). It gains a leading
alert glyph so a wrong PIN reads without hue.

---

## 4. Dashboard

Nine blocks become five.

| Block | Content |
| --- | --- |
| Header | Period title + period filter |
| Your moat | Ring (months of cover) + total balance + in/out/net |
| Needs attention | Insights, budget overspends and review queue, merged. Hides when empty |
| Saving | Savings-rate headline + one cash-flow chart; balance bridge behind a "How this period moved" disclosure |
| Where it went | Top 3 spending categories + "See all ›" |

### 4.1 Removed

- **Quick-actions row** — the `+` in the nav reaches the same three actions one
  thumb-reach closer.
- **Account-balances card** — a duplicate of the Accounts tab, one tap away.
- **Chart-mode switcher** — three views offered before the user has read one. The
  cash-flow view becomes the only view.

### 4.2 Relocated, not deleted

The balance bridge moves behind a disclosure inside the Saving block. It is genuinely
useful once a month and costs prime vertical space the other twenty-nine days.

---

## 5. PWA

### 5.1 Assets and manifest

- Icons: 192 and 512 PNG, maskable, and a 180px apple-touch icon. Only a single 512 PNG
  exists today.
- `theme_color` per colour scheme. It is currently hardcoded to `#080c0a` for both themes.
- Install `screenshots`, so Android renders the rich install card rather than the fallback.
- `shortcuts` for Add expense, Add income, and Paste from SMS.

### 5.2 Service worker

- A "new version ready — reload" prompt. Today a `CACHE_NAME` bump upgrades in place, but
  the running page keeps the old worker until every tab closes.
- **Background Sync that drains the existing outbox.** Moat is local-first: captures
  already write to IndexedDB and already work offline, and `lib/sync/engine.ts` already
  implements an outbox with `status`, `attempts` and conflict payloads. The gap is that it
  only drains while the app is open. Registering Background Sync to replay it closes that
  gap without building a second queue.
- A per-transaction pending indicator — a glyph, not a colour — so an unsynced capture is
  visible.

### 5.3 Verification

Safe-area behaviour for the floating capsule must be verified in real standalone mode on
iOS, where `env(safe-area-inset-bottom)` differs from its value in a browser tab.

---

## Testing

- Unit tests for any changed domain logic (dashboard block merging for "Needs attention").
- Existing suites must stay green: `npx tsc --noEmit && npm run lint && npm run test && npm run build`.
- Manual: greyscale check — screenshot the dashboard and lock screen, desaturate, and
  confirm every signal is still readable.
- Manual: iOS standalone safe-area check per §5.3.

## Follow-up (not this spec)

Rolling the new system across the remaining workspace routes — accounts, budgets, debt,
goals, recurring, learn, investment compass, settings, onboarding, and the transaction
sub-routes — including removal of the `tone` prop plumbing described in §1.5.
