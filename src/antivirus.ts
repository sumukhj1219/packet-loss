import type { GameState, PlayerComponent, ServerComponent } from './types';

export const ANTIVIRUS_COST = 1000;
export const ANTIVIRUS_RADIUS = 140;
// One timer does double duty: how long a placed tower stays active (ring + protection both
// disappear when it hits 0) and, since a new tower can't be placed until the old one is gone,
// the de-facto gap before another can go down. Independent of the per-server 5s post-patch
// IMMUNITY_DURATION_MS (patch.ts) — the two durations are never added together.
export const ANTIVIRUS_DURATION_MS = 10000;

// A single tower dropped at the player's current position. Servers inside its radius are
// excluded from every infection-spawn path in virus.ts (see isServerProtected) for as long as
// it's active. Expires automatically after ANTIVIRUS_DURATION_MS — see updateAntivirusTower.
export function attemptPlaceAntivirusTower(state: GameState, player: PlayerComponent): void {
  if (state.antivirusCooldownMs > 0) return; // silently ignore — previous tower still active
  if (state.dataPool < ANTIVIRUS_COST) return; // silently ignore — can't afford it

  state.dataPool -= ANTIVIRUS_COST;
  state.antivirusTower = { worldX: player.x, worldY: player.y, radius: ANTIVIRUS_RADIUS };
  state.antivirusCooldownMs = ANTIVIRUS_DURATION_MS;

  // Instant cure, not a patch — no reward/achievement/totalPatches side effects, just clears
  // whatever was already infected inside the radius at the moment the tower goes down.
  for (const server of state.servers) {
    if (server.state === 'INFECTED' && isServerProtected(state, server)) {
      server.state = 'IDLE';
      server.infectedAtMs = null;
    }
  }
}

// Counts the active tower's remaining lifespan down to 0, then clears it — both the visual
// ring and the protection effect end together, since both key off state.antivirusTower.
export function updateAntivirusTower(state: GameState, deltaMs: number): void {
  if (state.antivirusCooldownMs <= 0) return;

  state.antivirusCooldownMs = Math.max(0, state.antivirusCooldownMs - deltaMs);
  if (state.antivirusCooldownMs === 0) {
    state.antivirusTower = null;
  }
}

export function isServerProtected(state: GameState, server: ServerComponent): boolean {
  const tower = state.antivirusTower;
  if (!tower) return false;
  return Math.hypot(server.worldX - tower.worldX, server.worldY - tower.worldY) <= tower.radius;
}
