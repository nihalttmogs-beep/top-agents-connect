# TopAgents

A standalone glass-style portal for TopAgents. The app, build configuration, and project identity are maintained in this repository; it does not require a hosted editor or an external font service.

## What it does

- Keeps a signed-in demo session in the browser.
- Shows the daily task status and quick links to two separate chat rooms.
- Provides local demo chats with canned replies. Each room's message history is saved in that browser.

## Run locally

Requirements: Node.js 22+ and [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

Useful checks:

```sh
bun run test
bun run lint
bun run build
bun run preview
```

## Demo sign-in

- **Username:** `jannahtool`
- **Password:** `bebebooboo`

> **Demo only:** authentication and chat are implemented in the browser. The credentials are present in the client bundle and `localStorage` is not a secure session store. Do not use this mock login for real accounts or store sensitive customer data here. Replace it with server-side authentication and persistent messaging before production use.
