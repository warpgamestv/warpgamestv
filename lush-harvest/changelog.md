# Lush Harvest Changelog

All notable changes to **Lush Harvest** will be documented in this file.

---

## [3.2.0] — 2026-05-28 — Codex & Crowns

A content-focused drop. Express who you are with **Player Titles** earned from milestones. Take screenshots without HUD clutter via **Photo Mode**. Track every spirit, boss, and hidden secret you've encountered in the new **Codex**. Discover **Hidden Secrets** scattered randomly through the world. Test your boss-killing chops in the new **Boss Rush** arena unlocked after beating Eclipse Sovereign. And get notified the moment a new update lands with the **Patch Notes Callout**.

### Player Titles
- **14 unlockable titles** tied to existing milestones: *Wanderer*, *First Bloom*, *Voidwalker* (beat Spirit Lord), *Sovereign-Slayer* (beat Eclipse Sovereign), *Transcendent* (any ascension), *7-Day Devotee* / *30-Day Devotee*, *Daily Champion* (5+ daily seeds played), *Pathfinder / Voyager / Eternal Wanderer* (A5 / A10 / A20 reached), *Mote Magnate* (100k lifetime motes), *Starforged* (25 ⭐ harvested), *Cosmos-Touched* (any Cosmos node purchased).
- Each title is colored to its theme (cyan / lime / purple / gold / pink) and renders with a soft glow.
- **Equip** — new *Titles* section in the Profile panel shows every title as a chip. Click any unlocked chip to equip; locked ones are dimmed.
- **Display** — equipped title appears under your name in Profile and (when the leaderboard query returns it) under your name on global leaderboard rows.
- **Auto-fallback** to *Wanderer* if your equipped title's condition is no longer met (e.g., save reset).

### Photo Mode
- New **📷 Photo Mode** button in the top-right HUD next to the run-stats icon.
- Toggling enters a clean-stage view: every piece of HUD chrome is hidden (currency pane, minimap, objective, ability buttons, buffs, combo, daily banner, boss HP, bottom bar, toasts, patch callout, biome toast) — just the player + world art for screenshot capture.
- A small bottom-center glass pill reads *"Use your OS screenshot shortcut · Esc to exit"*.
- The toggle button glows gold while active so you can't accidentally forget you're in photo mode. Esc or the exit pill restores everything.

### Spirit Codex
- New **📖 Codex** entry in the Hub menu row. Three sections:
  - **Void Spirits** (4 entries: Glimmer / Creeper / Solar Flare / Shade)
  - **Bosses** (2 entries: The Spirit Lord / Eclipse Sovereign)
  - **Hidden Secrets** (3 entries: Wandering Sage / Lost Beacon / Phoenix Nest)
- Each entry includes icon, lore description, gameplay tip, encounter count, and first-seen date.
- Encounters are recorded on actual dispel completion (filters out shred kills so split deaths count once) and on boss defeats.
- Section headers show progress as `unlocked / total`. Locked entries render as a "?" placeholder until encountered.

### Hidden Secrets
- Rare world entities that spawn at a **25% chance on each area transition past Area 3** (skipped during daily mode to keep dailies deterministic). Weighted spawn picker biases toward the friendlier ones.
- **Wandering Sage** — touch grants one of 4 random blessings: 2× motes for 90s, +30% speed for 90s, all trees refilled, or +1 ⭐.
- **Lost Beacon** — auto-tethers the nearest untethered tree to the Forge. Free tether, no star-fragment cost.
- **Phoenix Nest** — +3 ⭐ immediately, but spawns 5 spirits over the next 1.25s. Risk-reward.
- Visually distinct: floating glowing icon with counter-spinning dashed ring and themed aura (cyan / lime / orange). Discovery toast reuses the achievement toast styling, tinted to the secret's color and labeled *"HIDDEN SECRET"*.

### Boss Rush Mode
- **Unlocked** automatically after defeating Eclipse Sovereign at least once. **👑 Boss Rush** button appears in the Hub menu.
- Snapshots your main run via the same isolation infrastructure used for daily mode — when you finish or forfeit, your main run restores exactly as you left it.
- Small **1,600 × 1,600 arena** with fresh upgrades (no inherited buffs — a pure skill check). Player drops in at center.
- Sequential queue: **Spirit Lord → Eclipse Sovereign → victory**. The next boss spawns 1.2s after the prior dies.
- Live **progress banner** at the top center shows `1 / 2` and includes a Forfeit button (confirm dialog before exit).
- **Victory rewards**: +25 ⭐, +5 ✨, plus a tracked **best time** with a *"NEW BEST"* highlight when beaten.
- The Boss Rush start panel shows your best time + total attempts.

### Patch Notes Callout
- Single-shot banner that slides in from the bottom-right on first load after `CURRENT_VERSION` changes. Tracked via `localStorage.lushHarvest:seenVersion`.
- Reads *"NEW UPDATE AVAILABLE · v3.X · [Update Name]"* with a primary **"See What's New"** button that opens the existing changelog viewer.
- A `×` dismisses without opening. Either action persists the seen version so it won't reappear until the next bump.
- Mobile: full-width chip stuck at the bottom.

### Persistence
- New save fields: `profile.title`, `codex` (spirits/bosses/secrets encounters), `bossRush` (bestTimeSec + attempts). All forward-compatible with v3.1 saves.
- Patch-callout `seenVersion` lives in localStorage independently so it's per-device.

---

## [3.1.0] — 2026-05-27 — Ascendant Update

Where 3.0 made the game beautiful, 3.1 makes it **alive**. Your runs now sync to the cloud and compete on a real worldwide leaderboard. Three new active abilities turn passive harvesting into a tactical loop. Random world events shake up every long run. A pair of bosses gate progression at Area 10 and Area 20, dropping exclusive crown cosmetics. After your first ascension, an entirely new tier of prestige upgrades — the **Cosmos** tier — opens up. Five new biomes extend the world to Area 42 and beyond. And a battery of quality-of-life improvements (performance mode, camera zoom, live daily-score banner, themed username generator wired into a real Player ID) round it out.

### Cloud Sync + Global Leaderboard
- **Supabase-backed cloud save**. Every local save is mirrored to the cloud (debounced 1.5s). On boot, the cloud copy is pulled if it's newer than the local copy (1s tolerance), letting players hop devices without losing progress.
- **Player identity**: the existing in-game **Player ID** (e.g. `LH-MPNHD6V9-8C3D7`) is the row key in all three cloud tables (`players`, `saves`, `scores`). Profile name changes are pushed alongside saves.
- **Global Leaderboard** with two sub-tabs inside the leaderboard panel:
  - *Top Runs* — all-time best motes earned in a single main run (submitted on ascension).
  - *Today's Daily* — global ranking on today's seeded challenge (submitted whenever you set a new daily PB).
  - Top 25 with gold/silver/bronze rank badges. Your own row is highlighted with a cyan border and a **"YOU"** pill.
- **Profile cloud indicator** — colored dot under your Player ID: gray = not configured, green pulsing = connected (with last-sync timestamp), red = error with the error message inline.
- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** — 5-minute provisioning guide with copy-paste SQL schema (3 tables + RLS policies), where to find your URL + anon key, and exactly which line of `main.js` to paste them into.

### Active Abilities — three keyed combat moves
- Purchased through the regular Mote upgrades panel (one-shot 800 / 1,500 / 2,500 motes, max level 1):
  - **Luminous Dash (Q)** — 160-unit directional dash with a five-step fading ghost trail; stuns any spirit within 100 units of the landing point. 12s cooldown.
  - **Chrono-Pulse (E)** — 280-radius AoE that freezes spirits in place for 6s *and* boosts in-range tree regrowth 3.5× for the same duration. Expanding cyan ring visual. 25s cooldown.
  - **Spirit Ward (R)** — Marks every active tether `wardedUntil = +12s` — incoming spirit hits dispel the attacker and the tether takes zero damage. Golden ripple emanates from the Forge. 30s cooldown.
- **HUD ability buttons** — three stacked glass buttons appear on the right side after unlock, each with a key-label badge (Q/E/R), cooldown-fill mask, and a glow when ready.
- `maxLevel` cap added to `renderUpgrades` so ability cards show "Unlocked" once purchased.

### Random World Events — biome-flavored mid-run buffs/debuffs
- 5 events with their own colors, durations, and effects, fired every 90–150s (60% chance per roll) once you reach Area 2:
  - **Aurora Boost** — 2× mote gain for 30s.
  - **Verdant Bloom** — instantly refills all trees + 2× regrowth for 30s.
  - **Mote Shower** — periodically rains free motes near the player for 20s.
  - **Void Eclipse** — spirits spawn 3× faster but motes earn 1.5× for 35s (risk-reward push).
  - **Glimmer Tide** — star trees regrow 4× faster for 45s.
- Announcement reuses the achievement toast styling, tinted with each event's signature color.
- Daily-mode runs are deliberately exempt so dailies remain a pure skill challenge.

### Endgame — Bosses + Cosmos Prestige
- **The Spirit Lord** spawns when you enter **Area 10** — 30 HP, 90px, slow, slams every 5s with a 1.5s telegraph at 200-radius for 18 pod damage. Drops 5 ⭐ + 1,200 motes + unlocks **Voidcrown**.
- **Eclipse Sovereign** spawns at **Area 20** — 80 HP, 130px, faster, slams every 3.8s with 1.1s telegraph at 260-radius for 30 pod damage. Drops 15 ⭐ + 2 sparks + 5,000 motes + unlocks **Sovereign Crown**.
- **Boss-gated progression**: the "Travel to Next Area" button shows a toast telling you to defeat the boss before continuing.
- **Combat**: burst hits deal 1 damage on each cooldown tick (200ms throttle), sentinels deal 0.5 damage on collision (700ms throttle) — encourages investing in companions before pushing the area cap.
- **Boss telegraph** — animated dashed ring at the slam target; if you're still in radius when it lands, you take damage and the screen shakes.
- **Death sequence** — boss spins-and-shrinks while 24 radial sparks fly outward; HP bar fades, rewards announced via the achievement toast styled as "BOSS".
- **HP bar UI** — fixed top-center, pink/purple gradient fill, only shown while a boss is alive.
- **Per-run vs ever defeat tracking**: `defeatedThisRun` gates spawning per ascension; `defeatedEver` permanently unlocks the cosmetic.
- **Cosmos prestige tier** — 5 new astral nodes unlock after your first ascension and require all base astral nodes:
  - **Cosmic Bloom** (10⭐) — +50% mote gain (stacks with Astral Attunement)
  - **Eternal Stride** (10⭐) — +30% move speed (stacks with Luminous Stride)
  - **Phantom Pouch** (12⭐) — +100 max pods (stacks with Celestial Pockets)
  - **Star Crucible** (12⭐) — +50% tether harvest yield
  - **Void Aegis** (15⭐) — 60% damage reduction from spirit hits
- Astral tree reflowed to a 4-row layout (12% / 28% / 46% / 72–90%) so Cosmos nodes get their own visually-distinct gold-purple bottom band.

### New Cosmetics (6 total)
Four buyable layered DOM sprites:
- **Orb Wisp** (2,500 motes) — cyan orb with three flowing ribbon tails swaying out-of-phase.
- **Phoenix** (8,000 motes) — molten flame body with feathered fire-wings flapping every 0.36s and three flicking tail flames.
- **Dusk Moth** (5 ⭐) — broad purple wings with golden eye-spots, twin antennae, slow oscillating wing pairs.
- **Lotus Bloom** (12,000 motes) — five-petaled pink rotor with three inner petals and a glowing gold core, slow 12s rotation in-game (with a separate non-translating animation for preview boxes so it stays centered).

Two boss-locked crowns (cannot be purchased — shop card shows "Defeat [Boss Name]"):
- **Voidcrown** — 5 graduated purple spikes, purple gem at center, white rune dot above, purple aura.
- **Sovereign Crown** — golden band with 5 spikes (center largest), three cyan gems set into gold, white-hot core dot above, gold aura.

### Five New Biomes — world deepens past Area 20
- **Frostbloom Tundra** (A22+) — icy cyan/white palette, slower regrowth.
- **Crimson Spire** (A26+) — red/orange aggression, faster spirits.
- **Astral Sanctum** (A30+) — gold + cyan harmony, balanced.
- **Mycelial Deep** (A35+) — lime + violet luminescence.
- **The Eternal** (A42+) — pure white on absolute black, the deepest theme. Spirits at 2.6× speed.
- Each biome contributes its own palette + fog color + spirit difficulty curve + BGM tone roots (ready for the audio pass).

### Daily Improvements
- **Daily streak counter** — tracks consecutive UTC days played, awards bonus Eternal Sparks at 3/7/14/30 day milestones (1/3/8/20 sparks). Displayed in the Profile lifetime grid as "Daily Streak: 4🔥 (best 12)".
- **Daily banner live score** — while in daily mode the banner reads `Daily · 2.3K / best 4.8K`, ticking every second, flipping to a green **"NEW BEST"** highlight the moment your current score passes your previous best.
- **In-run stats popover** — new 📊 button in the top-left HUD opens a glass panel showing motes/sec, pods/sec, and ETA to the current area's objective (h/m/s). Uses an exponential moving average on 5s smoothing for stable, non-jittery readouts.

### Settings Expansion
- **Performance Mode** — disables fog, fireflies, parallax, trail/harvest/sell particles, and glass backdrop blur. Massive FPS lift on low-end devices.
- **World Events** toggle — gates the random-event picker for players who prefer stable runs.
- **Camera Zoom** slider (70%–120%) — applies a `scale()` to the game-world each frame for either a strategic overview or tight focus.

### Persistence
- New save fields: `streak`, `bosses`, plus the existing `runSnapshots`, `dailyMode`, `profile`, `lifetime`, `runRecords`, `dailyBest`, `achievements`. All schemas remain forward-compatible — v3.0 saves load cleanly with defaults.
- Save-on-unlock for achievements and bosses so quick reloads can't lose progression state.

### Quality of Life
- Themed **random username generator** now wires into a real cloud Player ID for leaderboard submissions.
- Astral upgrade nodes get a Cosmos-tier visual variant (gold-purple gradient, gold border, special hover state).
- Boss-locked cosmetic shop cards show the gating boss's name with pink-border styling instead of a price.

### Fixes
- Cache-bust chain on `main.js` brought back into sync with the other asset query strings (previously stuck on `?v=2.3` while CSS + icons advanced separately).

---

## [3.0.0] — 2026-05-26 — Radiant Edition

A complete overhaul of visuals, progression, accessibility, and metagame. The world is no longer an emoji canvas — every entity, sprite, and panel was rebuilt as layered, animated DOM art with depth and motion. A persistent Hub now lives at your fingertips, a Daily Challenge runs alongside your main run without disturbing it, and milestones, leaderboards, and a profile complete the loop.

### Elevated Visuals
- **New Hub logo — pure inline SVG, no asset file**. A circular bioluminescent emblem that lives on the main menu / Hub overlay:
  - Stylized luminous tree silhouette (layered canopy + sculpted trunk + ground shadow)
  - Pulsing cyan crystal core at the canopy's heart (the game's signature glow)
  - Three dangling spore pods (lime / cyan / white) softly blinking out-of-phase
  - Aurora arc sweeping behind the tree
  - Rotating outer gradient ring (cyan → purple → lime over 38s) framed by a dashed inner halo
  - Three orbiting motes at different radii and speeds (14s / 22s / 18s, one reversed) echoing the gameplay loop
  - Scales infinitely; all animation is SMIL so it's GPU-cheap and runs without JavaScript; color stops match the game's neon CSS variables, so palette swaps theme it automatically. The PNG it replaced (`lush_harvest_logo_1773966169586.png`) is no longer referenced.
- **Layered tree art**: stacked canopy gradients with sway animation, drifting fireflies, sculpted trunks, bioluminescent halo.
- **Crystalline star trees**: dual counter-spinning gold halos, faceted crystal core with inner-light pulse, ambient twinkle sparks.
- **Light Forge**: three concentric rotating rings, white-hot core, three orbiting sparks, typographic Syne→Inter label.
- **Ancient shrines**: dual neon arches with a rotating diamond rune and base pedestal.
- **Void spirits — visually distinct per type**:
  - *Glimmer*: small, bright teal core, crisp ring
  - *Creeper*: large dark purple body, dashed counter-spinning ring
  - *Flare*: asymmetric hot pulse + expanding heat-wave projectile
  - *Shade*: black body with magenta seams, dashed pink ring (smaller "shred" variant on death)
- **Player redesign**: halo + counter-spinning ring + layered cyan glow drop-shadow.
- **Cosmetic sprites — fully redesigned as layered DOM art** (replacing flat emojis):
  - *Spark*: counter-spinning 4-ray star with diagonals, pulsing white-core
  - *Faerie*: iridescent cyan→purple wing pairs that flutter out-of-phase, golden body, antennae arc
  - *Sprite*: bobbing gold halo ring, twin shimmer wings, tiny head + cyan body, staggered pixie-dust trail
  - *Lantern*: rope + wood cap, gradient paper body with structural ribs, asymmetric flame flicker
- **Rocks & vines**: sculpted radial gradients with inset shading.
- **Player movement trail** — small fading particle tinted by equipped cosmetic.

### World & Atmosphere
- **Deep nebula background**: pitch-black base with multi-layered distant star dust, vignette pulse, and a slow drifting aurora ribbon.
- **Living fog layer**: biome-tinted screen-blend fog drifting at 75s cadence with top/bottom haze caps.
- **Parallax nebula clouds**: two layers drifting at 140s and 200s with mix-blend screen.
- **Ambient fireflies**: world-wide sparkle drift, dimmed for atmosphere.
- **Biome palette system**: each biome defines `bg / bgMid / accent / accent2 / fog`, pushed to CSS variables — the entire world re-themes in one transition.
- **Two new biomes**: *Whispering Canopy* (A4+) and *Cinder Sanctum* (A14+) for richer mid-progression variety.

### Hub, Profile, and Leaderboard
- **The Hub** (🏠 in the bottom bar): the main menu is no longer a one-shot intro — it's now a persistent overlay accessible anywhere, anytime. Daily, Profile, Leaderboard, and Settings all open from it.
- **Profile panel**:
  - **Randomized themed usernames** — every new player gets a unique name from a pool of 1,520 bioluminescent-forest combinations (e.g., *Spectral Stargazer*, *Bioluminescent Lantern*, *Quiet Keeper*).
  - Editable display name, debounced 400ms save.
  - **Live cosmetic avatar** — layered DOM render of your currently-equipped cosmetic.
  - **Player ID** — short readable ID (e.g., `LH-MPNHD6V9-8C3D7`) generated on first launch, ready for future global leaderboard submissions, with a 📋 copy button.
  - **Lifetime stats grid**: Runs, Ascensions, Highest Area, Lifetime Motes, Play Time, Joined date.
  - **Achievement summary card** with click-through to the achievements panel.
  - **Data management**: Copy / Load save string controls.
- **Leaderboard panel** with three tabs:
  - *Run Records* — best motes, highest area, fastest ascension, peak active tethers.
  - *Daily Best* — last 30 days of seeded scores with gold/silver/bronze badging.
  - *Global* — stubbed UI ready to wire up to a backend when cloud sync ships.

### Daily Challenge — fully isolated from your main run
- **Deterministic daily worlds** — a mulberry32-seeded RNG keyed to UTC date means every player gets the same world layout on the same day.
- **Snapshot-based isolation** — entering daily snapshots your main run; the daily run has its own world, motes, pods, star fragments, upgrade levels, and player position. Exit any time (gold banner button or Hub → Start Journey) and your main run restores **exactly** as you left it.
- **Resume mid-daily** — exit, play main, come back — your daily picks up where you left off (until tomorrow's seed replaces it).
- **Ascending in daily** completes the run, records best, and restores you to main.
- **Hub buttons are mode-aware**: labels change to "Return to Main Run", "Resume Daily Run", or "Daily Challenge · Best 4,820" based on state.
- **Persistent daily banner** — gold-glow chip below the HUD shows you're in daily mode, one-click exit.

### Achievements System
- **13 milestone achievements** covering pods, motes, stars, areas reached, tethers, and ascensions — each with a Mote or Star Fragment reward.
- **Toast notification** slides in from the top with icon, name, and reward when one unlocks.
- **Achievement panel** (🏆 in the bottom bar): progress bar per row, pulsing "Claim" button when unlocked, "Claimed" state once collected.
- Persisted in save; reload-safe (achievements remember unlock + claim state independently).

### Companion Progression
- Click any sentinel companion in the world to open the evolve panel — choose one of four specializations for 3⭐ each:
  - **Sentinel** — default defender, 400 dispel range
  - **Guardian** — extended 600 dispel range
  - **Gatherer** — passively harvests pods from nearby trees
  - **Scholar** — generates passive motes over time
- Each variant has a distinct color glow and a small gold "⇡" pip telegraphing it's clickable.

### Balance — Full Redesign
- **Smoother upgrade curves**: cheaper early purchases, gentler price multipliers (1.4–1.55 typical vs. 1.5–2.2), sqrt-based effects on Speed & Range so deep investment progresses without runaway costs.
- **Capacity** scaling now `lvl*12 + lvl^1.15` for a meaningful late-game ceiling.
- **Critical Bloom** bumped to 6% per level, capped at 60%.
- **Light Weaver / Sentinel** entry costs reduced (2⭐ / 8⭐) so star upgrades open up sooner.
- **Star tree drop rate** smoother and capped at 18%.
- **Ascension reward** now `sqrt(motes/1200)` — gentle early, exponentially more rewarding for deeper runs.
- **Objectives** smoother L1–L8 ramp, rotating types past level 8 with a tempered 1.32× exponential.

### Game Feel
- **Floating gain numbers**: `+1 ⭐` on star pickups (big-gold CRIT style), `CRIT ×2` on pod crits, accumulated `+N motes` at the forge (throttled to ~350ms so it doesn't spam).
- **Upgrade card tooltips** showing the next-level effect inline: `80 range → 98 range`. Maxed entries get a gold "★ Max" line.

### Accessibility
- **Reduced Motion** toggle — cancels nearly all animations via a body class.
- **Colorblind Mode** dropdown — Deuteranopia, Protanopia, Tritanopia palettes swap the five neon CSS variables to safer hues.
- **Unified typography** — Inter at weights 300–900 replaces the previous Inter+Syne pair, so every header, label, button, and form control reads consistently.
- **Themed select control** — proper dark background on options (fixes prior white-on-white dropdown).

### Persistence
- **Save format v3.0** stores: achievements, daily best, profile, lifetime, run records, run snapshots (main + daily), daily mode flag.
- All schemas are forward-compatible; existing saves load cleanly with default fallbacks.
- **Save-on-unlock**: achievements now persist immediately on unlock so a quick reload won't lose state.

### Fixes
- **Main menu position bug**: removed redundant `position: relative` override that broke the base `.overlay { position: fixed }`, so the menu now properly covers the full viewport instead of rendering halfway down the page.
- **Spark sprite centering**: added a non-translating spin animation for the cosmetic preview and profile avatar contexts where the parent already handles centering.
- **Hub logo ring "floating away"**: the rotating SVG groups had both a CSS `transform-origin: 100px 100px` and a SMIL `animateTransform` rotation pivot of `100 100` — the two stacked, offsetting the rotation center by the same amount as the pivot itself. Removed the CSS rule so the SMIL pivot is the single source of truth; the ring and orbiting motes now spin concentrically around the tree.
- **Stuck cache version on `main.js`**: the script tag was lagging behind the `?v=` bumps applied to the other assets, which made several earlier fixes look like they "didn't apply" on first try. Brought the script tag back into sync with the rest of the cache-bust chain.
- **Spirit spawn**: resolved an out-of-scope `biome` reference in `spawnVoidSpirit` by deriving the biome at spawn time.
- **Achievement reclaim on reload**: now persists immediately on unlock; explicit `claimed` check in the progress scanner prevents any chance of re-triggering after claim.

---

## [2.3.0] - 2026-03-19

### ✨ Added
- **Premium Main Menu**: Brand new professional main menu with bioluminescent particles and glowing typography.
- **High-Resolution Logo**: Stylized tree logo asset integrated as the centerpiece of the title screen.
- **Custom Scrollbars**: Modern neon purple/cyan gradient scrollbars for all game menus.
- **Void Sentinel**: New star upgrade that proactively defends tethers from spirits.
- **Premium Favicon**: Refined, high-contrast bioluminescent sprout icon for browser tabs.
- **Multi-Device Support**: Integrated `apple-touch-icon.png` for mobile and high-DPI clarity.

### 🚀 Optimized
- **Entity Lookup**: Implemented $O(1)$ `entityMap` for instant lookups during game loops.
- **Collision Detection**: Cached tether coordinates and simplified spirit-tether distance calculations.
- **Companion AI**: Refactored threat detection to remove triple-nested loops, greatly improving FPS.
- **General Performance**: Replaced expensive `Math.sqrt` and `Math.pow` calls with squared distance checks.
- **Deployment Automation**: Integrated GitHub Actions for seamless repository-to-website syncing.
- **Cache-Busting**: Implemented version-query parameters (`?v=2.3`) for immediate asset updates.

### 🛠️ Fixed
- **Companion Spawning**: Resolved a `ReferenceError` where companions failed to append to the correctly defined layer.
- **Tether Resilience**: Fixed a potential crash when spirits hit a tether that was recently removed or broken.
- **Menu Stagger**: Corrected the timing for the staggered entry animation for a smooth, high-fidelity feel.

---
*Created with ✨ and 🌿 by WarpGamesTV*
