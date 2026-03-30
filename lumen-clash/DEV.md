# Local development (frontend + Worker)

The game expects **HTTP APIs and `WebSocket /play` on the same host** as the page. This folder includes a small **Node proxy** (`server.js`) that serves static files on **port 8083** and forwards API routes plus `/play` to **Wrangler dev** on **port 8790**.

Full Worker setup and troubleshooting: **`Lumen-Clash/DEV.md`** in the backend repo.

## Layout

By default, scripts assume the **Lumen-Clash** repo lives next to **warpgamestv** on your machine:

```text
.../GitHub/
  warpgamestv/lumen-clash/    ← this folder (npm install here)
  Lumen-Clash/backend/        ← Worker (wrangler dev)
```

## One-time setup

1. **Install Worker deps** (once):

   ```bash
   cd /path/to/Lumen-Clash/backend && npm install
   ```

2. **Install site dev deps** (once):

   ```bash
   cd /path/to/warpgamestv/lumen-clash && npm install
   ```

## Run everything

From `warpgamestv/lumen-clash`:

```bash
npm start
```

This runs `wrangler dev` on **8790**, waits until the port is open, then starts the static server on **8083**.

Open **http://127.0.0.1:8083/** — Quick Match and APIs should hit your local Worker.

## Two terminals (optional)

```bash
# Terminal 1 — Worker
npm run backend

# Terminal 2 — Site + proxy (after 8790 is listening)
npm run dev
```

## Custom backend path

If `Lumen-Clash` is not at `../../Lumen-Clash/backend` relative to this folder, set the absolute path when starting the Worker (run from your backend directory as usual), or symlink/copy the repo into that relative path.

## Ports

| Port  | Role |
|------|------|
| 8790 | Wrangler dev (API + WebSocket) |
| 8083 | Static site + proxy (`LUMEN_FRONTEND_PORT` overrides) |

Override backend target for the proxy: `LUMEN_BACKEND_PORT=8790` (default).

## Troubleshooting

### `npm run backend` exits immediately or “Cannot find Worker backend”

- Clone **Lumen-Clash** next to **warpgamestv** (same parent folder), **or**
- Point to your checkout:  
  `LUMEN_CLASH_BACKEND=/absolute/path/to/Lumen-Clash/backend npm run backend`

### `502` from the site or “Backend unreachable”

- Wrangler is not listening on **8790**. Run `npm run backend` in a terminal and wait until it prints a ready URL (no errors).
- First-time Cloudflare: run `npx wrangler login` inside `Lumen-Clash/backend`.

### APIs work but **Quick Match** / WebSocket never connects

- Use **http://127.0.0.1:8083/** (the proxy), not raw **:8790**, so the browser and `/play` share one origin.
- The Worker allows **CORS** for `http://127.0.0.1` / `http://localhost` (any port) for local dev.

### Menu buttons do nothing / name stays “…”

- The page loads **Phaser** from the jsDelivr CDN in `index.html`. **Offline** or blocked CDN means the whole client script fails after Phaser — use a network, or vendor Phaser locally.
- If the Worker is down, `/profile` fails; the client still shows **Player** in the header after a failed fetch (not “…”). If you still see “…”, open the browser **Console** for a red error (often Phaser or `game.js` not loaded).

### Wrangler errors about config

- `backend/wrangler.toml` includes a **`[dev]`** block (port **8790**). Do not put production **`routes`** inside `[dev]`; they stay at the top level of the file.
