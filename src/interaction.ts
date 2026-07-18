import { beginPatch } from './patch';
import type { GameState, PlayerComponent, ServerComponent } from './types';

// SECTION 4.7 — proximity radius for patch eligibility, decoupled from the
// (tighter) player<->server collision footprint in Section 1.6. Must clear the
// collision system's ~68px minimum stand-off distance (footprint half + player
// radius) or the player can never get inside the radius at all — this needs a
// deliberate few-px buffer past that floor, not just "larger than SERVER_FOOTPRINT".
export const INTERACT_RADIUS = 80;

export function findInteractableServer(
  player: PlayerComponent,
  servers: ServerComponent[],
): ServerComponent | null {
  for (const server of servers) {
    if (server.state !== 'IDLE' && server.state !== 'INFECTED') continue;

    const dist = Math.hypot(server.worldX - player.x, server.worldY - player.y);
    if (dist <= INTERACT_RADIUS) return server;
  }
  return null;
}

// SECTION 4.7 — shared entry point for both click (pointertap) and spacebar interact.
export function attemptPatch(state: GameState, serverId: number): void {
  const player = state.player;
  if (player.currentState === 'PATCHING') return;

  const server = state.servers[serverId];
  const dist = Math.hypot(server.worldX - player.x, server.worldY - player.y);

  if (dist > INTERACT_RADIUS) return; // silently ignore — too far
  if (server.state !== 'IDLE' && server.state !== 'INFECTED') return;

  beginPatch(player, server);
  console.log(`[player] state=PATCHING facing=${player.facing} target=${server.id} @ ${state.elapsedMs.toFixed(0)}ms`);
}
