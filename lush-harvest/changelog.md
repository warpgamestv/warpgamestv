# 📜 Lush Harvest Changelog

All notable changes to **Lush Harvest** will be documented in this file.

---

## [2.3.0] - 2026-03-19

### ✨ Added
- **Premium Main Menu**: Brand new professional main menu with bioluminescent particles and glowing typography.
- **High-Resolution Logo**: Stylized tree logo asset integrated as the centerpiece of the title screen.
- **Custom Scrollbars**: Modern neon purple/cyan gradient scrollbars for all game menus.
- **Void Sentinel**: New star upgrade that proactively defends tethers from spirits.

### 🚀 Optimized
- **Entity Lookup**: Implemented $O(1)$ `entityMap` for instant lookups during game loops.
- **Collision Detection**: Cached tether coordinates and simplified spirit-tether distance calculations.
- **Companion AI**: Refactored threat detection to remove triple-nested loops, greatly improving FPS.
- **General Performance**: Replaced expensive `Math.sqrt` and `Math.pow` calls with squared distance checks.

### 🛠️ Fixed
- **Companion Spawning**: Resolved a `ReferenceError` where companions failed to append to the correctly defined layer.
- **Tether Resilience**: Fixed a potential crash when spirits hit a tether that was recently removed or broken.
- **Menu Stagger**: Corrected the timing for the staggered entry animation for a smooth, high-fidelity feel.

---
*Created with ✨ and 🌿 by WarpGamesTV*
