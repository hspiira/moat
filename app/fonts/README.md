# Fonts

One typeface, Geist Sans, for everything: body, headings, and the JSON blocks
in sync conflicts. No separate display or monospace family. Where figures have
to line up, `tabular-nums` does that job.

It comes from the `geist` npm package (`geist/font/sans`), which wraps
`next/font/local` around a variable file shipped inside the package. Nothing is
fetched at build time, so this keeps the property that made the fonts checked-in
before: `next/font/google` downloads during `next build`, and that broke CI on
2026-08-17 with twelve unresolved font modules. A package resolved at install
time does not have that failure mode, and it updates with `pnpm up geist`.

The trade: the package ships the full variable font at ~69KB where the
hand-subset latin file was ~29KB. It is served from `/_next/static/`, which the
service worker caches, so it is a first-load cost only.

## Helvetica Now, parked

Tried on 2026-08-20 and backed out. What was learned, so it does not have to be
learned twice:

- It is a commercial Monotype typeface. A **web** licence is a separate
  purchase from a desktop one, and it cannot be committed here the way an OFL
  font can. `.gitignore` keeps `helvetica-now-*.woff2` out of git.
- The files tried were **Helvetica Now Micro**, drawn for very small type. At
  the 14–16px this UI uses it set 28.6% wider than Helvetica, 378px against
  294px for the same string, wrapping headings onto two lines and truncating
  the search placeholder. The optical size a UI wants is **Text**.
- Their name tables were malformed: empty family name, a `☞` subfamily.
  Legitimate releases do not look like that, so check where any files came from.
- Only Light, Regular and Bold were available. The app leans on 500
  (`font-medium`) and 600 (`font-semibold`), so both would have collapsed into
  Regular and Bold by CSS weight matching.

To try again: get Helvetica Now Text in at least Regular, Medium and Bold, and
re-judge `--tracking-snug` in `app/globals.css`, which is `-0.008em` tuned for
Geist.
