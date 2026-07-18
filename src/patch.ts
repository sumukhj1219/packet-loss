import type { GameState, PlayerComponent, ServerComponent } from './types';
import { checkDuplicationThreshold } from './virus';
import { ACHIEVEMENTS, grantAchievement } from './wavedashIntegration';

export const PATCH_DURATION_MS = 1000;
export const IMMUNITY_DURATION_MS = 5000;
// Not in the PRD — a flat Data Pool reward for clearing an active infection,
// so responding to an outbreak feels rewarded rather than just damage-limiting.
// Raised from 200 to keep pace with drain now that multiple infections stack more often.
export const INFECTED_PATCH_REWARD = 350;
// SECTION 5.3 — RAPID_RESPONSE achievement window
const RAPID_RESPONSE_WINDOW_MS = 2000;

// SECTION 1.3.1 — MOVING|IDLE -> PATCHING entry
export function beginPatch(player: PlayerComponent, server: ServerComponent): void {
  player.velocityX = 0;
  player.velocityY = 0;
  player.currentState = 'PATCHING';
  player.facingLocked = true;
  player.facing = server.worldX - player.x >= 0 ? 'RIGHT' : 'LEFT';
  player.targetServerId = server.id;
  player.patchTimer = 0;
}

// SECTION 1.3.1 / 2.4 — counts patchTimer up, fires completePatch at 1000ms
export function updatePatching(state: GameState, deltaMs: number): void {
  const player = state.player;
  if (player.currentState !== 'PATCHING') return;

  player.patchTimer += deltaMs;
  if (player.patchTimer >= PATCH_DURATION_MS) {
    completePatch(state, player);
  }
}

function completePatch(state: GameState, player: PlayerComponent): void {
  const server = state.servers[player.targetServerId!];
  const wasInfected = server.state === 'INFECTED';
  const infectedDurationMs = wasInfected && server.infectedAtMs !== null ? state.elapsedMs - server.infectedAtMs : null;

  server.state = 'IMMUNE';
  server.immunityRemainingMs = IMMUNITY_DURATION_MS;
  server.infectedAtMs = null;
  state.totalPatches += 1;

  console.log(`[server ${server.id}] -> IMMUNE @ ${state.elapsedMs.toFixed(0)}ms (totalPatches=${state.totalPatches})`);

  checkDuplicationThreshold(state);
  if (wasInfected) {
    state.dataPool = Math.min(state.maxDataPool, state.dataPool + INFECTED_PATCH_REWARD);
    console.log(`[dataPool] +${INFECTED_PATCH_REWARD} for clearing server ${server.id} -> ${state.dataPool.toFixed(0)}`);
  }

  if (state.totalPatches === 1) {
    grantAchievement(ACHIEVEMENTS.FIRST_PATCH);
  }
  if (infectedDurationMs !== null && infectedDurationMs <= RAPID_RESPONSE_WINDOW_MS) {
    grantAchievement(ACHIEVEMENTS.RAPID_RESPONSE);
  }

  player.currentState = 'IDLE';
  player.facingLocked = false;
  player.targetServerId = null;
  player.patchTimer = 0;
}

// SECTION 2.4 — separate per-frame updater for the immunity countdown
export function updateImmunityTimers(state: GameState, deltaMs: number): void {
  for (const server of state.servers) {
    if (server.state !== 'IMMUNE') continue;

    server.immunityRemainingMs -= deltaMs;
    if (server.immunityRemainingMs <= 0) {
      server.immunityRemainingMs = 0;
      server.state = 'IDLE';
      console.log(`[server ${server.id}] -> IDLE @ ${state.elapsedMs.toFixed(0)}ms (immunity expired)`);
    }
  }
}
