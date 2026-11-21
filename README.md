# Nadiyah Fights

Nadiyah Fights is a Phaser + TypeScript + Vite + Colyseus multiplayer stick-figure fighting MVP.

## Run

```powershell
npm ci
npm run dev
```

The Windows `npm run dev` script starts the client at `http://localhost:5293` and the server at `http://localhost:2687`. For another platform, run `npm run dev:server` and `npm run dev:client` separately and configure `VITE_SERVER_URL` for the client.

## Validate

```powershell
npm run typecheck
npm run test
npm run build
npm run playtest
```

## V1 Scope

- 1v1 duel lobbies with host, lobby code, browse, join, ready, countdown, fight, KO, and rematch.
- Practice bot mode for solo smoke testing.
- Server-authoritative 60 Hz combat simulation with sequenced input bitmasks.
- Phaser renders the Nadiyah sprite sheet and combat VFX. Source artwork and the sheet-generation script are included.
- DOM HUD handles lobby controls, health, timer, ready state, and round result.

Future teams, free-for-all, weapons, ranked matchmaking, persistence, and rollback netcode are intentionally out of scope for this first playable foundation.

## Hosting

The Vite client and Colyseus server are separate services. Deploy the server with a persistent process and WebSocket support, then configure the client server URL for the target host. A static frontend alone does not provide online rooms. GitHub main contains the latest synced source; build and unit tests passed on November 20, 2026. Browser play and real network connectivity still require verification on the chosen host.
