import { playTowerSfx } from './audio';
import { SERVER_FOOTPRINT } from './config';
import { recordTowerPlacedStat } from './stats';
import type { GameState, PlayerComponent, ServerComponent } from './types';
import { ACHIEVEMENTS, grantAchievement } from './wavedashIntegration';

// SECTION 5.3 — AREA_DENIAL achievement: a single placement instantly curing this many
// infected racks at once.
const AREA_DENIAL_CURE_THRESHOLD = 3;

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
  state.antivirusTowersPlacedThisRun += 1;
  playTowerSfx();
  recordTowerPlacedStat(); // lifetime tower count + FIRST_LINE_OF_DEFENSE/TOWER_MASTER checks (Section 5.3)

  // Instant cure, not a patch — no reward/achievement/totalPatches side effects, just clears
  // whatever was already infected inside the radius at the moment the tower goes down.
  let curedCount = 0;
  for (const server of state.servers) {
    if (server.state === 'INFECTED' && isServerProtected(state, server)) {
      server.state = 'IDLE';
      server.infectedAtMs = null;
      curedCount += 1;
    }
  }
  if (curedCount >= AREA_DENIAL_CURE_THRESHOLD) {
    grantAchievement(ACHIEVEMENTS.AREA_DENIAL);
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

// Distance is measured center-to-center, but the ring should protect a server the moment it
// visually touches the server's sprite footprint, not only once the ring swallows the whole
// server — so the check is padded by half the server's footprint (see SERVER_FOOTPRINT).
// Without this, a server sitting right at the ring's edge reads as "inside" the ring on
// screen but was left unprotected.
export function isServerProtected(state: GameState, server: ServerComponent): boolean {
  const tower = state.antivirusTower;
  if (!tower) return false;
  return Math.hypot(server.worldX - tower.worldX, server.worldY - tower.worldY) <= tower.radius + SERVER_FOOTPRINT / 2;
}
