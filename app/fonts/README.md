# Fonts

One typeface, Geist Sans, for everything: body, headings, and the JSON blocks
in sync conflicts. There is no separate display or monospace family. Where
figures have to line up, `tabular-nums` does that job.

`geist-latin.woff2` is the latin subset of the variable font, covering
`wght 100..900`, so one file serves every weight the app uses.

Checked in rather than fetched at build time. `next/font/google` downloads
during `next build`, which makes a production build depend on a live request to
Google. That broke CI on 2026-08-17 with twelve unresolved font modules. An
offline-first app should not need the network to build.

Geist is licensed under the SIL Open Font License 1.1, which permits
redistribution: https://github.com/vercel/geist-font

## Replacing it

Drop the `.woff2` in here under the same name. `app/layout.tsx` refers to this
path and nothing else needs changing.

## Helvetica Now, parked

Moving to Helvetica Now was tried on 2026-08-20 and backed out. What was
learned, so it does not have to be learned twice:

- It is a commercial Monotype typeface. A **web** licence is a separate
  purchase from a desktop one, and it cannot be committed here the way an OFL
  font can. `.gitignore` keeps any `helvetica-now-*.woff2` out of git.
- The files tried were **Helvetica Now Micro**, which is drawn for very small
  type. At the 14–16px this UI uses it set 28.6% wider than Helvetica — 378px
  against 294px for the same string — which wrapped headings onto two lines and
  truncated the search placeholder. The optical size this UI wants is **Text**.
- Their name tables were malformed: an empty family name and a `☞` subfamily.
  Legitimate releases do not look like that, so check where any files came from.
- Only Light, Regular and Bold were available. The app leans on 500
  (`font-medium`, 116 uses) and 600 (`font-semibold`, 52 uses), so both would
  have collapsed into Regular and Bold by CSS weight matching.

To try again: get Helvetica Now Text in at least Regular, Medium and Bold, and
re-judge `--tracking-snug` in `app/globals.css`, which is `-0.008em` tuned for
Geist.
