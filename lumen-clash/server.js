/**
 * Local dev server: static files + proxy HTTP API and WebSocket /play to wrangler dev (default 127.0.0.1:8790).
 * Run with: npm run dev
 * Start the Worker first: npm run backend (from repo root) or npm run start (runs both).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

const API_ROUTES = [
    '/profile', '/set-username', '/leaderboard', '/add-friend', '/remove-friend', '/friends-status',
    '/create-private', '/join-private', '/update-presence', '/accept-friend', '/decline-friend',
    '/lobby-update', '/system-reset', '/reset-player', '/save-customization',
    '/friend-duel-invite', '/friend-duel-decline', '/friend-duel-accept'
];

const BACKEND_PORT = Number(process.env.LUMEN_BACKEND_PORT || 8790);
const FRONTEND_PORT = Number(process.env.LUMEN_FRONTEND_PORT || 8083);

/** Stable pathname from Node req.url (leading slash, no trailing slash, decoded). */
function pathnameFromReq(req) {
    let p = (req.url || '/').split('?')[0];
    try {
        p = decodeURIComponent(p);
    } catch (e) {
        /* keep raw */
    }
    if (!p.startsWith('/')) p = `/${p.replace(/^\/+/, '')}`;
    p = p.replace(/\/{2,}/g, '/');
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p || '/';
}

function isApiPath(urlPath) {
    return API_ROUTES.some((r) => urlPath === r || urlPath.startsWith(`${r}/`));
}

function proxyApiToBackend(req, res) {
    const headers = { ...req.headers, host: `127.0.0.1:${BACKEND_PORT}` };
    delete headers.connection;
    const proxyReq = http.request(
        {
            host: '127.0.0.1',
            port: BACKEND_PORT,
            path: req.url,
            method: req.method,
            headers
        },
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        }
    );
    proxyReq.on('error', (e) => {
        console.error('[proxy]', req.method, req.url, e.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: `Backend unreachable (${e.message}). Is wrangler dev running on port ${BACKEND_PORT}?` }));
    });
    req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
    const urlPath = pathnameFromReq(req);

    if (urlPath === '/changelog') {
        const changelogPath = path.join(__dirname, 'CHANGELOG.md');
        fs.readFile(changelogPath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Changelog Not Found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/markdown' });
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    if (isApiPath(urlPath)) {
        proxyApiToBackend(req, res);
        return;
    }

    let filePath = path.join(__dirname, urlPath);
    if (urlPath === '/') filePath = path.join(__dirname, 'index.html');

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    let isBinary = false;
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.png': contentType = 'image/png'; isBinary = true; break;
        case '.jpg': case '.jpeg': contentType = 'image/jpeg'; isBinary = true; break;
        case '.gif': contentType = 'image/gif'; isBinary = true; break;
        case '.ico': contentType = 'image/x-icon'; isBinary = true; break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (isApiPath(urlPath)) {
                proxyApiToBackend(req, res);
                return;
            }

            res.writeHead(404);
            res.end('File Not Found: ' + filePath);
        } else {
            res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', 'Expires': '0' });
            if (isBinary) {
                res.end(content);
            } else {
                res.end(content, 'utf-8');
            }
        }
    });
});

function forwardedHeadersRaw(req, backendPort) {
    const hop = req.rawHeaders;
    const lines = [];
    for (let i = 0; i < hop.length; i += 2) {
        const k = hop[i];
        const v = hop[i + 1];
        if (String(k).toLowerCase() === 'host') {
            lines.push(`Host: 127.0.0.1:${backendPort}`);
        } else {
            lines.push(`${k}: ${v}`);
        }
    }
    return lines.join('\r\n');
}

server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/play')) {
        const proxySocket = net.connect(BACKEND_PORT, '127.0.0.1', () => {
            const hdr = forwardedHeadersRaw(req, BACKEND_PORT);
            proxySocket.write(
                `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
                hdr +
                '\r\n\r\n'
            );
            proxySocket.write(head);
            proxySocket.pipe(socket);
            socket.pipe(proxySocket);
        });

        proxySocket.on('error', (err) => console.error('[ws proxy]', err.message));
        socket.on('error', (err) => console.error('[ws client]', err.message));
    } else {
        socket.destroy();
    }
});

server.listen(FRONTEND_PORT, '127.0.0.1', () => {
    console.log(`Lumen Clash dev: http://127.0.0.1:${FRONTEND_PORT}/`);
    console.log(`  API + WS /play -> 127.0.0.1:${BACKEND_PORT} (wrangler dev)`);
});
