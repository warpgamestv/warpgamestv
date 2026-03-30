# Lumen Clash v1.6 — Gemini / Antigravity continuation prompt

Use this document as **full context** when continuing Lumen Clash work in **Google Antigravity** (or any Gemini-powered IDE). Paste the **“Copy-paste prompt for Gemini”** section into a new chat, and attach or reference this file.

**Duplicate:** The same content lives at `C:\Users\WarpGamesHD\Desktop\Lumen Clash\GEMINI_ANTIGRAVITY_HANDOFF.md`. Prefer editing one and syncing the other when the handoff changes.

---

## Repository layout (Windows paths)

| Role | Path |
|------|------|
| **Canonical game + Worker source** | `C:\Users\WarpGamesHD\Desktop\Lumen Clash\` |
| | `backend\` — Cloudflare Worker (`wrangler.toml`, `src\index.js`, Durable Objects: `GameRoom`, `MATCHMAKER`, `PLAYER_PROFILE`, `ModerationHub`, etc.) |
| | `frontend\` — local static dev (mirrors site structure: `js\game.js`, `index.html`, `css\style.css`) |
| **Public site mirror (deploy)** | `C:\Users\WarpGamesHD\Documents\warpgamestv\lumen-clash\` |
| | Same `js\`, `css\`, `index.html` as production; **copy changes here after validating locally** |

**Workflow (from team spec):** ship and QA in **`Desktop\Lumen Clash`** first, then mirror into **`warpgamestv\lumen-clash`** for public deploy.

---

## Product constraints (do not contradict)

- **Web only** — no cross-play requirements.
- **Social:** friends list, online status, invites to private matches, **party** for **2v2** queue (not fully built).
- **2v2 (future):** simultaneous planning; when timer ends or **all** commit, resolve together.
- **Ranked (solo, future):** placement → estimated rank → MMR; **wide** matchups move rating **less**.
- **Quests:** server-authoritative progress; catalog in data (`V16_QUEST_CATALOG` / similar).
- **Events:** time-boxed configs; cosmetics, titles, XP/lumen multipliers (see `EVENTS_CATALOG` in Worker).
- **Moderation:** `POST /report` exists; persistence to KV/D1 + internal UI is **later**.
- **Mobile:** PWA-style manifest (`manifest.webmanifest`); optimize performance.
- **Progression:** XP from quests + Luminary Pass; **lumens** for shop / premium pass (shop later).
- **Hero select:** **no default hero for matches** — pick each match; menu hero is cosmetic/navigation.

---

## Already implemented (as of 2026-03-29)

### Backend (`Lumen Clash\backend\src\index.js`)

- **Versioning / dev** patterns as in repo.
- **`POST /report`** → ModerationHub DO (groundwork).
- **Quests + pass XP + lumens** — profile fields, `add-xp`, match end hooks (see CHANGELOG v1.6.0).
- **Luminary Pass / premium unlock** — `POST /unlock-premium` (server-side lumens).
- **Live events:** `EVENTS_CATALOG`, `getActiveEvents`, `combineEventXpMultiplier` / `combineEventLumenMultiplier`; profile and `add-xp` apply multipliers.
- **Mandatory hero on `/play`:**
  - `normalizePlayCharId(raw)` — accepts canonical ids and aliases (`knight`→`aegisKnight`, `sage`→`lumenSage`, `void_weaver`→`voidWeaver`, case-insensitive).
  - HTTP **`/play`** without valid `char` → **400** JSON `{ ok: false, error: 'Missing or invalid char' }`.
  - **GameRoom** WebSocket: invalid `char` → close **4001** `"Invalid hero"` (no silent default to Void Weaver).

### Static site (`warpgamestv\lumen-clash\`)

- **PWA:** `manifest.webmanifest`, `index.html` meta (`theme-color`, Apple web app).
- **Activity:** quests, events block, social hooks.
- **Cache busters:** e.g. `game.js?v=67` in `index.html` — **bump when changing `game.js`** so CDN/browsers pick up changes.

### Client (`js\game.js` — both repos)

- **`connectWebSocket`:** Uses **`heroSelectPick.charId || menuChar`**; **`skin`** on query string; **`encodeURIComponent`** on `char`, `uid`, `skin`, `roomId`; early return if no hero with user-visible message.
- **`clientVersion`** in report payload (keep in sync with CHANGELOG when changing behavior).

---

## Not done — roadmap order (prioritize)

1. **UI consistency pass** — modals, typography, mobile breakpoints vs main menu / battle HUD.
2. **Quests (next slice)** — richer objectives, claim flow, event-driven overrides.
3. **Events system** — more data-driven configs (no hard-coded per-event client logic); tune `EVENTS_CATALOG` dates/multipliers for real seasons.
4. **Ranked queue** — placement counter, hidden MMR + visible tier, wide-match delta scaling.
5. **Friends + presence hardening** — reliable online/offline; invite payloads with room/party id.
6. **Private invite + party** — party leader creates room; invitees join party before queue; matchmaker **2v2** when ready.
7. **2v2 rules + resolution** — four players, simultaneous commit, battle state extensions; heavy QA.
8. **Emote/cosmetic locks by level** — data-driven unlock tables from account level.
9. **Lumen shop + premium pass** — spend lumens; economy server-side.
10. **Moderation dashboard** — persist reports (KV/D1), simple internal review UI.

---

## Deploy commands (verify `wrangler.toml` / account)

```bash
cd "C:\Users\WarpGamesHD\Desktop\Lumen Clash\backend"
npx wrangler deploy
```

Static site: deploy `warpgamestv` repo (e.g. Cloudflare Pages) from `lumen-clash/` or your pipeline.

---

## Local verification checklist

- [ ] `node --check` on edited `backend\src\index.js` and `js\game.js`.
- [ ] Quick match connects; hero select + lock-in still works.
- [ ] Invalid `char` on `/play` rejected (400 or 4001).
- [ ] After **any** `game.js` or `style.css` change, bump **`?v=`** in `index.html`.
- [ ] Mirror **`Desktop\Lumen Clash\frontend\`** → **`warpgamestv\lumen-clash\`** for files you changed before production deploy.

---

## Files to know

| Area | Files |
|------|--------|
| Worker entry + routes | `backend\src\index.js` |
| Wrangler config | `backend\wrangler.toml` |
| Game client | `js\game.js`, `index.html`, `css\style.css`, `manifest.webmanifest` |
| Changelog | `warpgamestv\lumen-clash\CHANGELOG.md` |
| Local dev server | `Lumen Clash\frontend\server.js` (proxies `/play` to local Worker port; see `DEV.md`) |

---

## Copy-paste prompt for Gemini (Antigravity)

Paste everything below into a **new** Gemini / Antigravity task. Attach this repo or `GEMINI_ANTIGRAVITY_HANDOFF.md` if the tool supports files.

```
You are continuing development on the Lumen Clash web game (Phaser + Cloudflare Workers + Durable Objects).

REPOS (Windows):
- Source + Worker: C:\Users\WarpGamesHD\Desktop\Lumen Clash\
  - backend\ = Wrangler Worker (src\index.js has GameRoom, matchmaking, profile, quests, events, /play, /report, etc.)
  - frontend\ = local static mirror (js\game.js, index.html, css\)
- Public deploy mirror: C:\Users\WarpGamesHD\Documents\warpgamestv\lumen-clash\
  - Copy changes here from Desktop\Lumen Clash\frontend\ after local QA.

WORKFLOW: Implement and test in Desktop\Lumen Clash first; mirror to warpgamestv\lumen-clash for deploy; deploy Worker from backend\ with wrangler deploy.

CONSTRAINTS: Web-only; server-authoritative quests/progression; no default hero for matches; events/quests from data; mobile PWA-friendly.

ALREADY DONE (do not redo unless fixing bugs):
- Quests, Luminary Pass XP, lumens, add-xp, match stats, /report groundwork, events catalog + multipliers on profile/add-xp, PWA manifest, Activity UI for quests/events.
- Mandatory hero: normalizePlayCharId in /play and GameRoom; client connectWebSocket sends char+skin with encodeURIComponent; game.js cache bust v67+ in warpgamestv index.html.

NEXT PRIORITIES (pick with user): UI consistency; quest claim flow + richer objectives; ranked (placement, MMR, tier); friends/presence hardening; party + 2v2 matchmaker + four-player battle; level-gated cosmetics; Lumen shop; moderation dashboard persistence.

RULES FOR EDITS:
- Match existing code style; minimal diffs; keep cache-busters in index.html when touching game.js or style.css.
- Run node --check on edited JS files.
- Update CHANGELOG.md in warpgamestv\lumen-clash for user-visible changes.

Read GEMINI_ANTIGRAVITY_HANDOFF.md in lumen-clash for full paths and checklist.
```

---

## End of handoff

When resuming, ask the human which **numbered roadmap item** (1–10 above) to tackle first, or whether they need a **bugfix** branch.
