# 📜 Lush Harvest Changelog

All notable changes to **Lush Harvest** will be documented in this file.

---

## [2.4.0] - 2026-03-20

### ✨ Added
- **Randomized Spirit Themes**: The primary spirit threat now changes every 5 levels, selecting from 4 unique types to keep gameplay dynamic.
- **Unique Spirit Behaviors**:
    - **Depth Creeper**: Gains a massive speed boost when stalking from a distance (>500 units).
    - **Solar Flare**: Emits periodic pulses that slow down the regrowth of nearby trees by 80%.
    - **Void Shade**: Splits into two fast-moving "Shreds" when dispelled, requiring quick reactions.
- **Visual Variety**: Each spirit type has its own distinct color, glow, and animation (Cyan for Creeper, Gold for Flare, Glitchy-Grey for Shade).
- **New Effects**: Added expanding "Flare Pulse" visual and "Tree Slowed" UI indicators.

### 🚀 Optimized
- **Game State v2.4**: Updated the save system to track the active spirit theme consistently across sessions.
- **Asset Versioning**: Incremented asset query strings to `?v=2.4` for seamless updates.

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
