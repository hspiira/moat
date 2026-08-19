# Fonts

The app uses one typeface, Helvetica Now, for everything: body, headings, and
the JSON blocks in sync conflicts. There is no second family and no monospace.
Where figures have to line up, `tabular-nums` does that job.

## The files are not here, and cannot be

Helvetica Now is a commercial Monotype typeface. Unlike the fonts that used to
live here — Geist and Bricolage Grotesque, both SIL Open Font License, which
permits redistribution — its licence does not allow checking the files into a
repository. It is also not on Google Fonts, so there is nothing to fetch at
build time.

A **web** licence is a separate purchase from a desktop one, and Monotype meters
web use. Buying the desktop font does not license the `.woff2`.

Until the files are added, `--font-sans` in `app/globals.css` falls back to
Helvetica, then Arial. That is close enough to judge spacing and layout against,
and it is not the real typeface. macOS and iOS have Helvetica; Windows and
Android will land on Arial or their own substitute.

## Adding them

1. Put the licensed web files here, ideally one variable file:
   `helvetica-now-latin.woff2`.
2. Declare it in `app/layout.tsx` with `next/font/local`, the way the previous
   fonts were, exposing `--font-sans`:

   ```ts
   const helveticaNow = localFont({
     src: "./fonts/helvetica-now-latin.woff2",
     variable: "--font-sans",
     display: "swap",
     weight: "100 900",
   });
   ```

   Then put `helveticaNow.variable` back on the `<html>` element, and drop the
   literal stack from `--font-sans` in `app/globals.css` so the variable wins.
3. Re-judge `--tracking-snug`. It is `-0.008em`, tuned for Geist to make it read
   tighter. Helvetica Now sets differently and probably does not want it.

If the licence forbids self-hosting and requires Monotype's CDN, that conflicts
with this being an offline-first app that must build and run without the
network. Check before buying.
