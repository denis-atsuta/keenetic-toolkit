# Privacy Policy — Keenetic Toolkit

_Last updated: 2026-07-18_

Keenetic Toolkit is a browser extension for managing a Keenetic router on
your local network: switching access policies of connected devices and
maintaining domain-based routing lists.

## What the extension stores

All data is kept locally in your browser's extension storage
(`chrome.storage`). Nothing is synced or uploaded anywhere.

- **Router profile** — the router's address and the username you enter.
- **Derived credential hash** — the extension never stores your router
  account password. Authentication uses the router's challenge–response
  scheme, and only a derived hash (`ha1`) is kept. By default it lives in
  memory for the session; persisting it is an explicit opt-in. Note: with
  persistence enabled, the hash is stored unencrypted in extension storage,
  and anyone with access to your browser profile could use it to
  authenticate on the router. This is why we recommend creating a dedicated
  router account for the extension instead of using your main one.
- **Preferences** — favorites, filters, hidden policies, last opened section
  and similar UI state.

## What the extension sends, and where

Requests go to exactly one place: **your router, on your local network**,
using its HTTP API. There are no third-party servers, no analytics, no
telemetry, no error reporting, and no tracking of any kind.

## Page scan

The optional "scan page" feature reads the list of hosts loaded by the
current tab — only when you open the popup and click scan (`activeTab`).
The result is shown to you and used solely to build routing lists on your
router. Page content is not collected, stored, or transmitted.

## Permissions

- `storage` — save the router profile and preferences locally.
- `declarativeNetRequestWithHostAccess` — strip the `Origin` header on
  requests to your router (its CSRF guard rejects requests carrying a
  browser origin). Affects only hosts you have explicitly granted.
- `scripting`, `activeTab` — power the page-scan feature on your click;
  no background access to any page.
- Host access is requested at runtime for your router's address only.

## Contact

Questions or concerns: open an issue at
<https://github.com/denis-atsuta/keenetic-toolkit/issues>.
