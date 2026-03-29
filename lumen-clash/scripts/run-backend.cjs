#!/usr/bin/env node
/**
 * Runs `npm run dev` in Lumen-Clash/backend with a clear error if the path is missing.
 * Override: LUMEN_CLASH_BACKEND=/absolute/path/to/Lumen-Clash/backend
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const resolved =
    process.env.LUMEN_CLASH_BACKEND ||
    path.join(__dirname, '..', '..', '..', 'Lumen-Clash', 'backend');
const pkg = path.join(resolved, 'package.json');

if (!fs.existsSync(pkg)) {
    console.error('[lumen-clash] Cannot find Worker backend at:', resolved);
    console.error('  Expected: …/GitHub/Lumen-Clash/backend (sibling of warpgamestv).');
    console.error('  Or set: LUMEN_CLASH_BACKEND=/path/to/Lumen-Clash/backend');
    process.exit(1);
}

const child = spawn('npm', ['run', 'dev'], {
    cwd: resolved,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env }
});
child.on('exit', (code) => process.exit(code ?? 0));
