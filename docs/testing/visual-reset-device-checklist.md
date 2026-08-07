# Visual reset — device verification checklist

| Field | Value |
| --- | --- |
| Status | Awaiting device pass |
| Owner | Piira |
| Created | 2026-08-08 |
| Scope | Everything shipped since the visual reset (branch `refactor/code-quality-remediation`) |

Estimated time: 15–20 minutes with one iPhone and one Android phone. Tick items
off in place; note failures inline with the device and OS version.

## iOS Safari, installed to home screen

- [ ] Install via Share → Add to Home Screen. The icon is the red dot-cluster
      mark, not a generic tile.
- [ ] Open the installed app. The status bar area and the bottom capsule both
      clear the system UI: the capsule sits just above the home indicator, not
      halfway up the screen and not underneath it.
- [ ] Lock screen: with a passkey enrolled, the default view is mark + status
      line + "Use PIN instead", and Face ID prompts automatically. Cancelling
      Face ID reveals the keypad without anything jumping.
- [ ] Rotate through Home, Transactions, Accounts, Report: the active pill in
      the capsule names each page; no page shows a large heading repeating the
      pill.
- [ ] Bottom of every list clears the capsule — the last row can be read and
      tapped, not hidden behind it.

## Android Chrome, installed

- [ ] The install prompt (or menu → Install app) appears and installs.
- [ ] Long-press the installed icon: the Add expense / Add income / Paste
      shortcuts appear and each opens the right capture mode.
- [ ] Share an MTN/Airtel SMS to Moat: the share target opens capture with the
      text prefilled.

## Both devices

- [ ] Dashboard in bright light: In/Out/Net readable, every money figure
      carries a sign or arrow, nothing relies on colour alone. If possible,
      enable greyscale (iOS: Accessibility → Display → Colour Filters;
      Android: Digital Wellbeing → Bedtime mode) and confirm money in vs out
      is still distinguishable.
- [ ] Report page: position chart renders, calendar cells show signed amounts,
      7/30/90 selection survives a full app kill and relaunch.
- [ ] Airplane mode: capture an expense. It saves. Re-enable data with the app
      open: the capture syncs without visiting Settings (hosted sync accounts
      only), and the clock glyph on the row clears.
- [ ] A new deploy while the app is open shows the "A new version is ready"
      pill; Reload picks up the new version.
- [ ] Category picker on a phone keyboard: opens scoped to the transaction
      type, search filters, list never extends past the screen.

## Screenshots to capture while there (for the manifest install card)

Take two portrait screenshots on the Android device once the seeded data looks
presentable — the dashboard and the report page — and drop them in
`public/screenshots/` as `dashboard.png` and `report.png` (1080×2400 or the
device's native resolution). Then add to `app/manifest.ts`:

```ts
screenshots: [
  { src: "/screenshots/dashboard.png", sizes: "1080x2400", type: "image/png" },
  { src: "/screenshots/report.png", sizes: "1080x2400", type: "image/png" },
],
```

Real screenshots only — the install card is a promise about what the app looks
like.

## Failure notes

| Item | Device / OS | What happened |
| --- | --- | --- |
| | | |
