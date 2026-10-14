# Gameserver-Manager

Integrated into the existing Create React App / React Context desktop and 98.css. No dependencies added and no deployment or infrastructure changes made. There is no router, chart library, existing API client, or monitor app in this checkout.

## Source

- New: src/apps/GameserverManager/{GameserverManager.tsx,gameserver.css,api.ts,useServers.ts,GameserverManager.test.tsx}, public/retro-server.svg, .env.example.
- Updated: Desktop, AppIcon, WinWindow, WindowArea, Taskbar, WindowManagerContext, window.css, App.test.tsx, tsconfig.json, .gitignore, Music.tsx (unused import cleanup).
- Components: German keyboard-accessible tabs, ListView overview, server group boxes, clipboard action, lightweight SVG history plots, paginated event list with selection, connection/status bar.
- AppIcon supports selection followed by double-click or Enter for the new app. Existing icons retain their behavior. The manager has one instance and reopens by restoring it. The shared window component gains maximize/restore; the manager can be resized using its native resize grip.
- tsconfig moduleResolution changed from bundler (unsupported by installed TypeScript 4.9) to node, compatible with CRA.
- Gallery is mocked only in tests because its webpack require.context cannot run under Jest. The obsolete starter test was replaced.

## Verified API contract

Inspected authorized backend repository at commit 52f971df92361fb586d8597bd2e69e3e0d59c0b0 (local ignored checkout). Public servers, metrics and SSE responses were also checked directly on 2026-10-14. The browser only uses public HTTPS endpoints under https://api.mueller-it-mkk.de/games/api/v1/public/:

- GET servers
- GET servers/:slug/players
- GET servers/:slug/metrics?limit=100
- GET servers/:slug/events?limit=25&page=N
- GET stream (EventSource)

Configure the origin using REACT_APP_GAME_API_BASE_URL in .env.local; rebuild after changing it. No credentials are sent. Details use the complete public ServerDto returned by the list; overview/detail endpoints exist but need no redundant calls.

SSE handles connected, keepalive, status.changed, players.changed, player.joined, player.left and server.error. connected always resynchronizes REST state because the backend has no durable replay. Changes are coalesced over 500 ms, requests serialized, and in-flight requests/subscriptions/timers cleaned up on close. Browser EventSource reconnects automatically. A 30-second REST refresh updates probe timestamps/history and acts as polling fallback. A 45-second heartbeat timeout marks the live connection interrupted. Minimizing retains the open app and its subscription.

UNKNOWN and TCP_ONLY never become OFFLINE. Missing values remain unavailable, and stale snapshots are labelled. Graphs use recorded timestamps and leave null/unknown gaps. Bounded snapshots are not presented as uptime or calculated availability. Player names require the API's available flag. Only persisted API events are listed; SSE notifications are not fabricated as event history.

## CORS action required outside this frontend task

Requests with Origin https://mueller-it-mkk.de, https://www.mueller-it-mkk.de and http://localhost:3000 returned HTTP 200 without Access-Control-Allow-Origin. Browser REST and SSE access will fail until the deployed NestJS CORS_ORIGINS includes the exact frontend origins. For those hosts use:

CORS_ORIGINS=https://mueller-it-mkk.de,https://www.mueller-it-mkk.de,http://localhost:3000

Retain any existing authorized origins; omit www if unused and localhost from production if development access is unnecessary. Redeploy/restart the API with that environment setting and verify Access-Control-Allow-Origin matches the requesting origin for both REST and SSE. The backend already enables GET and credentials:false. No proxy or browser workaround is used. The actual deployed frontend origin is not recorded in the frontend repository, so confirm window.location.origin if serving from another host (GitHub Pages uses https://tschanni.github.io).

## Validation and limits

Jest/Testing Library covers registration, selection, single instance, minimize/restore/maximize/close, keyboard tabs, missing metrics, state mapping, errors/retry, empty lists and SSE resync/update/cleanup. Production build, tsc --noEmit and ESLint pass locally. Seven tests pass; remaining console notices are the existing stale Browserslist data and Node punycode deprecation. No automated browser/screenshot tooling is available here: exact 1366×768/1920×1080 rendering and real browser CORS/live updates still need visual verification. Responsive styles constrain the manager to the viewport and use a full available window on small screens.

No uptime field or backend availability calculation is exposed. Terraria TCP_ONLY does not supply player counts/version/latency. Event severity is not exposed. Events are per selected server with real pagination. Optional resources may be restricted by the public reverse-proxy allowlist; their errors are displayed independently of server summaries.
