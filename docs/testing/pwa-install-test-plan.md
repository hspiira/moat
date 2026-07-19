# PWA Install Test Plan

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | `TBD` |
| Last updated | 2026-04-06 |

## Purpose

This checklist covers installed-mode validation for Moat on the two highest-value mobile paths:

- Android Chrome install prompt
- iPhone Safari Add to Home Screen

I cannot execute these device flows from the current environment, so this is the manual test plan that should be run on real devices.

## Android Chrome

### Preconditions

- Open the production build over `https`.
- Visit the app more than once so Chrome is willing to show the install prompt.
- Confirm the manifest and service worker are active.

### Checks

1. Open the app in Chrome on Android.
2. Confirm the browser shows the install affordance or that the in-app `Install app` button appears.
3. Install the app.
4. Launch from the home screen.
5. Verify:
   - opens in standalone mode
   - browser chrome is gone
   - icon is legible
   - top and bottom nav respect safe areas
   - offline page appears if network is disabled and a fresh route is requested
   - local account, transaction, and goal data still loads without network

## iPhone Safari

### Preconditions

- Open the production build over `https`.
- Use Safari, not an embedded browser.

### Checks

1. Open the app in Safari.
2. Use `Share > Add to Home Screen`.
3. Launch from the home screen.
4. Verify:
   - standalone launch works
   - app title and icon look correct
   - viewport safe areas are respected
   - top and bottom app bars do not overlap OS chrome
   - local saved data is available after relaunch
   - offline page appears when reconnecting is not possible

## Pass Criteria

- Install works on Android Chrome.
- Add to Home Screen works on iPhone Safari.
- Installed mode feels like an app, not a website inside a browser frame.
- Core local finance flows remain usable without network.
