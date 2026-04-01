# Lumen Clash

## v1.7.0 â€” Admin Live Ops + Announcements (2026-03-31)
### Added
- **Admin Control Center**: Added a protected `/admin` hub with tabbed navigation into reports, events, flags, and announcements.
- **Admin Events Management**: The `/admin/events` page now supports queueing events, starting them immediately, stopping them manually, returning them to schedule mode, and deleting them.
- **Feature Flags**: Added `/admin/flags` with persistent toggles for quests, shop, premium unlocks, reports, friend invites, ranked queue, and 2v2 queue.
- **Global Announcements**: Added `/admin/announcements` plus a player-facing scrolling marquee fed by backend-managed announcement state.

### Changed
- **Backend / Live Ops Persistence**: Event catalogs, feature flags, and announcements are now stored through the global admin Durable Object so changes survive refreshes and immediately affect live backend logic.
- **2v2 Party Lobby Polish**: Improved party-lobby readiness feedback with clearer ready counts, ready badges, pulse feedback, and more tolerant party websocket message handling between client and server.
- **Client Polling**: The frontend now polls a lightweight public config feed to keep live announcements in sync without requiring a full refresh.

## v1.6.8 — Quest Reward System & Damage Tracking (2026-03-31)
### Added
- **Frontend Damage Tracking**: Implemented real-time damage delta logic in `game.js` to accurately populate match statistics during gameplay.
- **Improved Victory Splash**: The post-game UI now prioritizes server-authoritative telemetry for damage dealt, damage taken, and ability usage, ensuring quest progress is displayed accurately.
- **Quest System Fixes**: Resolved a critical issue where damage-based quests failed to reward players due to empty telemetry payloads and cross-origin communication errors.

### Fixed
- **Backend CORS Stability**: Corrected CORS header handling for proxied requests in the main Worker, resolving 405 Method Not Allowed and cross-origin blocked errors on `/claim-quest` and `/unlock-premium`.
- **Persistent Ban Notifications**: Ensured that ban notification modals correctly display for both temporary and permanent bans upon match completion.

## v1.6.7 — Moderation Dashboard & Ban Notifications (2026-03-31)
### Added
- **Moderation Dashboard**: Integrated a robust admin interface for player management, featuring real-time lookup, temporary bans (24h/7d), and permanent bans.
- **Banned Player UI**: Implemented a persistent "Access Denied" modal for banned players that includes a real-time countdown timer showing when access will be restored.
- **Backend Automations**: The `PlayerProfile` system now automatically handles ban expirations and state cleanup without manual intervention.

### Fixed
- **Victory Screen Visibility**: Resolved a race condition where the match result overlay would fail to appear if post-game telemetry was delayed.
- **Rematch Sprite Sync**: Ensured that character models in the Phaser scene correctly update to match player selections during rematches, even when switching classes.
- **Report Button Restoration**: Restored the visibility and interaction of the report button on mobile HUDs and the victory splash screen.

## v1.6.6 — Friends + Presence Hardening (2026-03-30)
### Changed
- **Client & Presence**: The frontend now utilizes a persistent 30-second heartbeat to reliably track online status even when players sit idly on the menu. The server strictly enforces a 60-second inactivity timeout before dropping a friend's status to Offline.
- **Social Invites**: Abstracted the legacy "Duel Invite" system into a generalized cross-service `invite-send` and `invite-take` route. Payloads now explicitly parse `room` and `party` types to prepare for upcoming 2v2 functionality.

## v1.6.5 — Events System Overhaul (2026-03-29)
### Changed
- **Backend / Events**: Overhauled the global `EVENTS_CATALOG` to natively support pushing `grantedTitles` and `grantedCosmetics` directly into player accounts just for logging in during active windows. No hard-coded client logic.
- **Frontend / Activity**: The Live Events popover now correctly parses and displays any real-time seasonal rewards (titles, cosmetics) granted to players alongside the normal XP and Lumen multipliers.
- **Season 1**: Activated "Season 1: Neon Ascension" granting the "Pioneer" title to all active players.

## v1.6.4 — Quests Slice 2: Match Telemetry Metrics (2026-03-29)
### Added
- **Backend / Quests**: Quest trackers now support and accumulate `damage` and `abilities` metrics sent via `/internal/add-xp`. Added three new quests to the global catalog: **d_dmg** ("Deal 1000 damage" - Daily), **d_abil** ("Use 15 abilities" - Daily), and **w_dmg** ("Deal 5000 damage" - Weekly).
- **Frontend / Activity**: The main menu Activity popover now dynamically calculates and displays progress for quests based on damage output and ability usage.

## v1.6.3 — UI Consistency & Standardization (2026-03-29)
### Changed
- **Modals**: Upgraded Battle Pass and Character Preview menus to use the new `.lumen-modal-screen` glassmorphism framework instead of legacy popup boxes.
- **Typography & Panels**: Purged inline CSS (`style="..."`) from the Profile, Social, and Leaderboard menus. They now use standardized `lumen-panel` classes with correct fonts (`Rajdhani`, `Outfit`).
- **Mobile Breakpoints**: Unified responsive layout thresholds. The main menu and battle HUD now both swap to portrait and compact tracking exactly at `768px` instead of mismatched widths.

## v1.6.2 — Mandatory hero on `/play` + client parity (2026-03-29)
### Added
- **Backend**: `normalizePlayCharId()`; **`/play`** returns **400** if `char` is missing or invalid; **GameRoom** closes websocket **4001** if `char` fails validation (no default **`voidWeaver`** fallback).
- **Client**: `connectWebSocket` builds **`/play`** with **`encodeURIComponent`** for `char`, `uid`, `skin`, `roomId`; prefers **`heroSelectPick`** over menu-only selection; **`game.js?v=67`** (site), **`game.js?v=51`** (local `frontend/`).

### Docs
- **`GEMINI_ANTIGRAVITY_HANDOFF.md`**: handoff prompt for continuing v1.6 roadmap work in Antigravity / Gemini.

## v1.6.1 — Live events + PWA manifest (2026-03-29)
### Added
- **Backend**: Server-driven **`EVENTS_CATALOG`** (time windows); **`/profile`** (`get-stats`) returns **`eventsCatalog`**, **`activeEvents`**, **`eventXpMultiplier`**, **`eventLumenMultiplier`**. During an active event, **Luminary Pass XP** gain from matches uses the event multiplier; **quest lumen** payouts use the lumen multiplier. **`add-xp`** response includes **`passXpApplied`** and event fields for debugging.
- **Web**: **`manifest.webmanifest`** (standalone, theme colors) + **`index.html`** meta (`theme-color`, Apple web app) for **Add to Home Screen** on mobile browsers.
- **Activity** popover: **Live events** block when any event is active (names + multiplier summary).

### Changed
- **`game.js?v=66`**, **`style.css?v=36`**, report **`clientVersion` `1.6.1`**.

## v1.6.0 — Quests + Pass XP + Lumens (2026-03-29)
### Added
- **Backend** (`Lumen-Clash/backend`): Daily/weekly **quest** metrics (UTC day / ISO week), **Luminary Pass XP** (`luminaryPassXp` += match class XP), **banked lumens** (rank rewards + quest bonuses + **`POST /unlock-premium`** spend); extended **`POST /internal/add-xp`** from `GameRoom` with **matchStats**; **`/profile`** returns **`questCatalog`**, **`questMetrics`**, **`lumens`**, **`bpPremiumUnlocked`**. **`POST /report`** → **`ModerationHub`** Durable Object (last 500 entries). **`wrangler.toml`** routes **`/report`**, **`/unlock-premium`**; migration **v6** `ModerationHub`.
- **Activity** popover shows quest progress; **Luminary Pass** modal shows **Pass XP** and **banked Lumens** (`bp-pass-xp`, `bp-lumens-server`); **Unlock Premium** deducts **100** server lumens via **`/unlock-premium`**.
- **Post-match splash**: **Quest completion** line when **`postGame.questCompleted`** is present; **Report player** → **`POST /report`**. **`style.css?v=35`**, **`game.js?v=65`**.

## v1.5.5 — game.js load fix (2026-03-29)
### Fixed
- **`ReferenceError: Cannot access 'gameState' before initialization`**: `syncGameContainerPointerEvents()` ran at parse time before `let gameState` was initialized (temporal dead zone). **`gameState`** is now declared next to **`game`** before the first sync. **`game.js?v=61`**.

## v1.5.4 — Production parity (cache + overlay stacking) (2026-03-29)
### Fixed
- **Site looked like the old “floating hero” bug**: Browsers and CDNs often kept **cached** `game.js` / `style.css` after deploy. **Cache-busters** bumped (`style.css?v=32`, `game.js?v=60`, `background.css?v=3`). **`_headers`** (Cloudflare Pages) sets **short cache** for `/js/*` and `/css/*` (and `/lumen-clash/...` if the game lives under a subpath).
- **Overlays**: `#matchmaking-overlay` / `#hero-select-overlay` **z-index** raised to **99999** with **`isolation: isolate`** and **`translateZ(0)`** so WebKit still paints queue/hero UI **above** WebGL in production.

## v1.5.3 — Local menu clicks & profile header (2026-03-29)
### Fixed
- **Main menu felt dead on local dev**: `#main-menu-container` used **`pointer-events: none`** with only the header and center column set to **`auto`**, so clicks in **side margins** and other gaps hit the **Phaser canvas** (Phaser sets the canvas to **`pointer-events: auto`**). The menu shell is now fully clickable, canvases use **`pointer-events: none`** until battle (`.game-container--battle`), and **`syncGameContainerPointerEvents`** runs after the Phaser scene **`create()`**.
- **Profile header after failed `/profile`**: On fetch error, the menu header still updates to at least **Player** instead of leaving the **“…”** placeholder.

## v1.5.2 — Queue & hero select above the canvas (2026-03-28)
### Fixed
- **Blank queue / hero select (only Phaser hero visible)**: While the main menu was hidden, the game container used **`pointer-events: auto`**, which in WebKit/Safari often promotes the **WebGL canvas above** sibling HTML. Matchmaking and hero-select overlays sat **under** the canvas, so you saw a floating sprite with no spinner or lobby UI. The canvas is now interactive only during **`IN_PROGRESS`**; **`#matchmaking-overlay`** and **`#hero-select-overlay`** use **`position: fixed`** and a high **z-index** so they always paint on top.

## v1.5.1 — Matchmaking overlay visibility (2026-03-28)
### Fixed
- **Queue / hero select hidden**: `#matchmaking-overlay` lived inside `#main-menu-container`, so when the menu was hidden after connecting, the spinner and hero-select flow disappeared and only the Phaser canvas showed (looked like an empty arena or battle view). Matchmaking is now a **sibling** of the main menu with a higher **z-index** so it stays visible until the match starts.
- **Lobby state**: `HERO_SELECT` and `WAITING_FOR_PLAYERS` no longer require `myPlayerId` to apply layout; **`updateUI`** bails safely if `gameState` is null.

## v1.5.0 — Pre-match hero select (2026-03-27)
### Added
- **Server-driven hero select**: When both players are in a room, the match enters **`HERO_SELECT`** before **`IN_PROGRESS`**. The worker stores each player’s **`hero_select_pick`** / **`hero_select_ready`**, broadcasts **`HERO_SELECT_UPDATE`** (deadline + lock state), and starts the round after both lock in or after a **20s** timeout.
- **Rematch / Best of 3**: After **`GAME_OVER`**, agreed rematches route through **hero select** again so you can swap hero/skin between games while preserving **series** state.

### Changed (website)
- **Hero select UI** stays in sync with the **`HERO_SELECT`** game state (not only “two players waiting”), so the overlay no longer disappears when the server advances past **`WAITING_FOR_PLAYERS`**.
- **Presence**: Hero select counts as **In match** for friend status.
- **Reconnect**: Automatic reconnect also applies during **`HERO_SELECT`**.

### Deploy notes
- **Static site** (`warpgamestv` repo): `lumen-clash/` front end.
- **Worker** (`Lumen-Clash` repo): deploy **`backend/`** with Wrangler so **`HERO_SELECT`** and websocket actions match the client.

## v1.4.0 — Luminary Pass premium UX & profile titles (2026-03-26)
### Added
- **Luminary Pass refresh**: Full-screen **glass / neon** layout aligned with other Lumen menus; clearer rank header and horizontal reward track.
- **Lumens & Premium unlock (client)**: Free-track **Lumens (💠)** milestones and a **progress meter** toward unlocking **Premium** from play (persisted in `localStorage` as `lumen_clash_bp_premium_unlocked` once eligibility is met).
- **Profile → Display title**: Equip **unlocked titles** from the Player Profile screen (with hint text); **Save** persists via the same **`/save-customization`** API used for skins.
- **More pass rewards**: New **Knight/Sage skins** (**Crimson Knight** and **Astral Sage**) plus additional **rank titles** on the Luminary Pass track—for example **Recruit**, **Tactician**, **Arc Warden**, **Starforged**, **Mythbreaker**, **Season Vanguard**, and **Paragon**, alongside existing emote, skin, and credit nodes. _(Ensure your backend grants `unlockedTitles` entries that match these display names when players reach the corresponding ranks.)_
- **Void Weaver — Abyssal & Lumen Legend**: Dedicated textures (`void_weaver_abyssal.png`, `void_weaver_legend.png`) are loaded and swapped like **Verdant**; menu/battle scale compensates when variant PNG resolution differs from the base sprite. Replace the bundled placeholders with your final art when ready.

### Changed
- **Character Customize**: **Skin variant** only in the roster preview modal; **titles** moved to **Profile** so progression and identity are centralized.

### Notes
- **Backend parity**: If titles do not appear after ranking up, update server logic so rank-ups add the new title strings to **`unlockedTitles`** to match the client pass table.

## v1.3.0 — Menu readability & social polish (2026-03-22)
### Added
- **Friend challenges**: **Challenge** on a friend creates a private match and sends a **duel invite** they can accept or decline under Social; challenger waits in the matchmaking overlay.
- **Friend presence**: Friends can show richer status (**In menu**, **In match**, **Private lobby**, **Away**, **Offline**) using a lightweight presence heartbeat to the server.
- **Last chosen character**: The roster class you last picked (or saved customization for) is stored in `localStorage` and drives the **main menu hero** and default queue class after reload.
- **Best of 3 (post-match)**: XP splash adds **Best of 3** beside **Challenge Again**; when both players pick it, subsequent games count toward **first to 2** with a live series line on the splash. Between rounds, only **Next round** is shown until the set is decided.
- **Rematch feedback**: Opponent choice is surfaced (**One more game**, **Best of 3**, **Next round**); if choices conflict, a short message asks you to match.
- **Duel invite toast**: Pending duel invites show a main-menu **banner** with **Open Social** so invites are harder to miss.
- **Main menu header (top right)**: **Pilot** strip shows **username** and **account rank**; **Activity** (bell) opens a small inbox for **friend requests** and **duel invites** (with a footnote that quests, seasonal rewards, and events can land here later).

### Changed
- **Main menu left rail**: Larger typography for **nav labels**, **hints**, the **Luminary Pass** row, and rank badge so sidebar actions are easier to read (including stacked mobile layouts).
- **Accessibility “Larger UI text”**: Sidebar sizes scale up a bit further when that setting is enabled.

### Fixed
- **Local dev API proxy**: Node static server now matches API paths reliably (normalized URL path, proxy-before-files) so POST routes like **`/friend-duel-invite`** reach wrangler instead of returning a filesystem 404; clearer JSON errors when the backend is unreachable.
- **Private room cleanup**: `GameRoom` WebSocket teardown now uses **`this.env`** for the matchmaker client (was a stray `env` reference).
- **XP / rank display**: Account **rank** is derived from class levels, but the UI was pairing it with **lifetime `stats.xp`** and a `rank × 100` curve (wrong). Profile and splash bars now use **sum of class XP / sum of (level×100)** (“roster XP”). Roster class cards use **xp / (level×100)** for their fill. **`/profile`** recomputes rank from stored class levels to fix drift. Default **`add-xp`** class id is **`aegisKnight`** (not `knight`) so XP isn’t stored under a dead key.

## v1.2.0 — Responsive Polish & Character Rendering (2026-03-22)
### Added
- **Settings → Performance overlay**: Optional FPS readout plus approximate **HTTP ping** to `/profile` (round-trip latency), persisted in `localStorage`.
- **Settings → Accessibility**: **Larger UI text**, **high contrast** shell for menus/HUD, **high-visibility HP bar** colors (blue vs amber), and **reduce motion** (cuts CSS animations/transitions).
- **Settings → Combat feedback tuning**: Added user-selectable **Camera shake** and **Hit-stop** intensity levels (`Off`, `Medium`, `High`) that apply during damage reactions.
- **Post-match breakdown**: XP splash now includes match stats (**damage dealt**, **damage taken**, **abilities used**, **turn swaps**) for quick self-review.
- **Settings tabs**: Options are now organized into **Gameplay**, **Accessibility**, and **System** sections for faster navigation.
- **Menu VFX toggle**: Added a gameplay setting to disable animated menu effects for cleaner visuals and lower distraction on mobile.
- **Pretty changelog viewer**: In-game changelog now renders with readable formatting (headings, sections, bullets, emphasis) instead of plain raw text.

### Changed
- **Main menu responsiveness**: Improved behavior across different aspect ratios, including mobile-friendly layout adjustments and better stacking/spacing for narrow viewports.
- **Mobile visual pass (global)**: Refined phone/tablet layout for menu, combat HUD, roster, modals, and splash screens; improved touch target sizing, spacing, and portrait readability.
- **Mobile compact pass**: Reduced button footprint and reorganized portrait HUD flow to minimize overlap (health cards, status/timer, abilities, and emotes now fit with less collision on small screens).
- **UI polish**: Added custom themed scrollbars across scrollable panels and lists.
- **Selected hero presentation**: Active chosen character now appears behind the main menu UI layer for stronger visual identity while preserving menu readability.
- **Void Weaver skin parity**: Fixed **Verdant Void Weaver** scale inconsistencies so it matches standard Void Weaver sizing in menu and battle scenes.
- **Connection resilience**: Added temporary disconnect recovery with automatic reconnect attempts (up to 3) before falling back to manual return.

### Fixed
- **Sprite background artifacts**: Removed visible dark/black matte backgrounds from character sprites when rendered in Phaser and preview contexts.

## v1.1.0 — Main Menu & Presentation (2026-03-22)
### Added
- **Animated menu backdrop**: Linked `background.css` and added the `#menu-background-layer` markup (nebula, particles, scanlines, vignette) so the main menu shows the intended background.
- **Header tagline** under the game title on the main menu.

### Changed
- **Main menu layout**: Professional shell with a **left navigation rail** (Luminary Pass, Team, Rankings, Profile, Social, Settings) and a **primary Play** action anchored **bottom-right** in the main area.
- **Combatant panel**: Right-aligned **glass-style card** (“Active combatant”) with refined typography; Play button uses a dedicated **primary CTA** style (title + “Find a match” subtitle).
- **Responsive behavior**: Main menu **stacks** on narrow or short viewports (`max-width: 720px` or `max-height: 500px`) using rules scoped to the menu so **combat HUD** compact styles still apply only when the viewport is **short**, not merely narrow.
- **Post-match overlay**: `#xp-splash-overlay` moved to the **top of `<body>`** for more reliable stacking and input behavior; splash flow also hides **`#ui-container`** so the HUD does not sit above the results screen.
- **Splash actions**: Rematch and Main Menu on the splash use dedicated handlers with guarded listeners; **Social** included in the global menu **click** sound list.

## v1.0.0 — Luminary Pass & Customization (2026-03-21)
### Added
- **Luminary Pass**: A global account progression system with 20 ranks of rewards.
- **Character Levels**: Per-character XP/leveling (Max Level 100) with permanent stat bonuses (+10 HP, +2 ATK per level).
- **Customization System**: Equip unlocked Skins and Titles via the new Character Preview menu.
- **New Skin**: "Verdant" variant for Void Weaver unlocked at Rank 3.
- **Dynamic Sprites**: In-game characters now reflect your equipped skin variants.
- **UI Overhaul**: New premium modals for Battle Pass and Character Previews.

### Fixed
- **Global UI Interactions**: Fixed unresponsive "X" close buttons across all menus by improving z-index and pointer-event layering.
- **ID Synchronization**: Aligned character metadata between frontend and backend to ensure consistent stat application.


## v0.9.0 — Social & Private Matches (2026-03-21)
### Added
- **Social System**: Mutual friends list with online status tracking.
- **Private Matches**: Create a room with a 6-digit code to play with specific friends.
- **Presence Tracking**: Automatic "Online" status updates while the game is open.
- **API Proxying**: Unified backend traffic through port 8083 for better mobile connectivity.

## v0.8.0 — Emotes & Sound System (2026-03-21)
### Added
- **Quick Emotes**: Send one of 4 preset emotes during matches — visible as a floating speech bubble over your character for both players.
- **Emote Presets**: Choose your 4 quick-use emotes from a pool of 16 via Settings → Emote Presets. Selection is persisted in localStorage.
- **3-second emote cooldown** prevents spam while keeping communication fluid.
- **Procedural Sound System**: Retro synthesized sound effects via `AudioContext` — no audio files required.
  - UI click blip on all menu buttons
  - Descending frequency "pew" on ability use
  - Noise burst + bass thud on taking damage
  - Ascending arpeggio on heals
  - Metallic sweep on shields/dodge
  - Dual-tone chirp on emote send/receive
  - Victory fanfare or defeat dirge on game over
- **Sound Toggle**: Enable/disable all sound effects from Settings → Sound: ON/OFF.

### Changed
- Settings buttons for Sound and Emote Presets are now fully functional (previously "Coming Soon").

## v0.7.0 — Settings & UI Polish (2026-03-21)
### Added
- **Profile Modal** with an all-new Match History tracking your last 10 games.
- **Settings Modal** featuring a "Delete Save Data" button and an in-game Changelog viewer.
- **Custom Disconnect Modal** replacing jarring browser alerts when opponents leave.
- **Upgraded Typography**: Replaced system fonts with high-quality Google Fonts (`Outfit` for readable text, `Rajdhani` for sci-fi headers).
- **Glassmorphism UI**: Added a sleek background blur (`backdrop-filter`) and energetic pop-in animations to all menus.
- **Improved Navigation**: Menus can now be closed by clicking the dark background, and "Close/Confirm" buttons were standardized to "Back ↩".

## v0.6.0 — Global Leaderboard (2026-03-21)
### Added
- **Global Top 50 Leaderboard** accessible from the main menu.
- **Leaderboard Server Infrastructure**: New `Leaderboard` Durable Object securely ranks players by wins, using Level and XP as tie-breakers.

## v0.5.0 — Abilities & Combat Overhaul (2026-03-21)
### Added
- **4 unique abilities per class** with cooldown timers
  - Void Weaver: Shadow Strike, Void Burst, Shadow Step (dodge), Drain (damage + heal)
  - Aegis Knight: Shield Bash, Fortify (50% shield), Holy Smite, Iron Wall (100% shield)
  - Lumen Sage: Arcane Bolt, Radiant Burst, Heal Light, Supernova
- **Shield mechanic** — blocks a percentage of the next incoming hit, then breaks
- **Dodge mechanic** — completely avoids the next attack
- **15-second turn timer** with visual countdown bar; auto-passes turn on expiry
- **4-slot ability bar** replaces old Attack/Special buttons
- Cooldown counters displayed on each ability button
- Shield/Dodge status badges shown under health bars

## v0.4.0 — Username System (2026-03-21)
### Added
- **Random username generation** on first visit (e.g. `SwiftFalcon42`, `VoidReaper817`)
- **Editable usernames** via profile card with inline editor
- **Username uniqueness** enforced by global `UsernameRegistry` Durable Object
- Usernames shown in combat HUD instead of generic "You" / "Opponent"
- `/set-username` API route with validation (3-16 chars, alphanumeric + underscores)

## v0.3.0 — Mobile Responsive Layout (2026-03-21)
### Added
- **"Rotate Device" overlay** for portrait mode on mobile
- Mobile landscape CSS media queries at two breakpoints (500px, 400px)
- Dynamic sprite scaling based on screen height
- Viewport meta prevents pinch-to-zoom

### Changed
- Sprites repositioned from 60% to 50% screen height
- Player Profile card restyled from absolute-positioned to inline layout
- Combat HUD padding reduced for mobile fit

## v0.2.0 — Player Profiles & Progression (2026-03-21)
### Added
- **Persistent player profiles** using `localStorage` UUID + `PlayerProfile` Durable Object
- XP and leveling system (100 XP per level, 50 XP for wins, 10 XP for losses)
- Player Profile card on main menu showing level, XP bar, and win/loss record
- XP awarded automatically on match completion

### Fixed
- `crypto.randomUUID()` crash on non-secure HTTP origins (LAN IPs)
- Node.js proxy incorrectly serving binary assets (PNGs) as UTF-8
- Undeclared `prevTurn` variable crash in return-to-menu handler

## v0.1.0 — Initial Release (2026-03-20)
### Added
- 3 character classes: Void Weaver, Aegis Knight, Lumen Sage
- Real-time 1v1 multiplayer via WebSocket + Cloudflare Durable Objects
- Matchmaking system with automatic room assignment
- Phaser.js game canvas with custom character sprites
- Character selection roster
- Health bar HUD with hit animations
- Main menu with character preview
