# Nadiyah Fights

Nadiyah Fights is a Phaser + TypeScript + Vite + Colyseus multiplayer stick-figure fighting MVP.

## Run

```powershell
npm install
npm run dev
```

Client: `http://localhost:5173`
Server: `http://localhost:2567`

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
- Phaser renders a procedural stick-figure sprite-sheet character and combat VFX.
- DOM HUD handles lobby controls, health, timer, ready state, and round result.

Future teams, free-for-all, weapons, ranked matchmaking, persistence, and rollback netcode are intentionally out of scope for this first playable foundation.
