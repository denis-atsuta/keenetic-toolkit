<img src="assets/logo.svg" width="72" align="right" alt="Keenetic Toolkit logo">

# Keenetic Toolkit

Chrome extension for managing a [Keenetic](https://keenetic.com/) router without opening its web UI.

Targets KeeneticOS **5.1+**. Talks to the router directly over its local HTTP API (RCI) — nothing goes through third-party servers.

## Features

### Devices

- Every host the router knows, with online status, IP and MAC.
- Switch the access policy per device right from the popup: default, segment default, any named policy, or "no internet".
- Search by name/IP/MAC, filter by online/new, pin favorites first.
- Hide policies you never use from the selector (Settings).

### Routing

- Manage DNS-route address lists (domains and IP/CIDR entries): create, rename, edit addresses, delete.
- Bind a list to an interface (VPN, WISP, …) with auto-add and exclusive-route options, toggle rules on/off.
- **Normalize** folds redundant entries: subdomains covered by a listed parent domain and IPs covered by a broader CIDR.
- **Scan page** collects every host the current tab loaded, grouped by domain — pick what to route and drop it into a new or existing list. Works for blocked pages too: route the domain, reload, rescan to discover the next layer.

## Security

- Challenge-response authentication only; the password itself is never stored — only a derived hash (`ha1`), kept in memory by default with opt-in persistence.
- All requests go straight to the router on your LAN.
- Host access is requested at runtime for the router's address only; `scripting`/`activeTab` power the page scan and reach nothing without your click.
- Recommended: create a dedicated router account for the extension instead of using your main one.

## Install (developer mode)

```bash
npm install
npm run build      # production build into .output/chrome-mv3
```

Then open `chrome://extensions`, enable **Developer mode** and **Load unpacked** → `.output/chrome-mv3`.

## Development

```bash
npm run dev        # dev build with HMR (load .output/chrome-mv3-dev unpacked once)
npm run compile    # typecheck
```

Built with [WXT](https://wxt.dev) + React + TypeScript.

## License

[MIT](LICENSE)
