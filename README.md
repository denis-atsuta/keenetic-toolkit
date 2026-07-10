# Keenetic Toolkit

Chrome extension for managing a [Keenetic](https://keenetic.com/) router without opening its web UI.

## Features (planned)

- Switch connection policies (policy-based routing) for hosts directly from the extension popup.
- Manage static routes for hosts and IP addresses.

Targets KeeneticOS **5.1+**. Talks to the router over its local HTTP API (RCI); credentials never leave your browser — only a derived hash is stored, and all requests go directly to the router on your LAN.

## Development

```bash
npm install
npm run dev        # launches Chrome with the extension loaded, HMR enabled
npm run build      # production build into .output/chrome-mv3
npm run compile    # typecheck
```

Built with [WXT](https://wxt.dev) + React + TypeScript.

## License

[MIT](LICENSE)
