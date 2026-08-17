# Fonts

Checked in rather than loaded through `next/font/google`.

`next/font/google` downloads the font files during `next build`, which makes a
production build depend on a live request to Google. That broke CI on
2026-08-17: the runner received CSS pointing at `bricolagegrotesque/v9` files
that returned 404, and the build failed with twelve unresolved font modules.
The same URLs resolved fine elsewhere at the same moment, so it was CDN
staleness rather than an outage — which is exactly the kind of failure that
recurs. An offline-first app should not need the network to build.

| File | Family | Axis range served |
| --- | --- | --- |
| `geist-latin.woff2` | Geist | `wght 100..900` |
| `geist-mono-latin.woff2` | Geist Mono | `wght 100..900` |
| `bricolage-grotesque-latin.woff2` | Bricolage Grotesque | `opsz 12..96, wdth 75..100, wght 400..700` |

All three are the latin subset, matching the `subsets: ["latin"]` the Google
loader was configured with. They are variable fonts, so one file covers every
weight the app uses.

Both families are licensed under the SIL Open Font License 1.1, which permits
redistribution:

- Geist and Geist Mono — https://github.com/vercel/geist-font
- Bricolage Grotesque — https://github.com/ateliertriay/bricolage

## Replacing them

Fetch the latin block from the Google CSS for the family and axis range in the
table above, then drop the `.woff2` in here under the same name. Nothing else
needs changing; `app/layout.tsx` refers to these paths.
