# Lush Harvest Changelog

All notable changes to **Lush Harvest** will be documented in this file.

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
