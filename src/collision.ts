import { ROOM_HEIGHT, ROOM_WIDTH, SERVER_FOOTPRINT, WALL_THICKNESS } from './config';
import type { PlayerComponent, ServerComponent } from './types';

// SECTION 1.6 — Player movement clamping (room walls). Bound is inset by WALL_THICKNESS on top
// of boundingRadius so the player's edge stops at the wall's inner face, not the room's outer edge.
export function clampToRoom(player: PlayerComponent): void {
  const minX = WALL_THICKNESS + player.boundingRadius;
  const maxX = ROOM_WIDTH - WALL_THICKNESS - player.boundingRadius;
  const minY = WALL_THICKNESS + player.boundingRadius;
  const maxY = ROOM_HEIGHT - WALL_THICKNESS - player.boundingRadius;
  player.x = Math.max(minX, Math.min(maxX, player.x));
  player.y = Math.max(minY, Math.min(maxY, player.y));
}

// SECTION 1.6 — Player<->server collision (AABB, resolved after movement, before render)
export function resolveServerCollisions(player: PlayerComponent, servers: ServerComponent[]): void {
  const half = SERVER_FOOTPRINT / 2;

  for (const server of servers) {
    const dx = player.x - server.worldX;
    const dy = player.y - server.worldY;
    const overlapX = half + player.boundingRadius - Math.abs(dx);
    const overlapY = half + player.boundingRadius - Math.abs(dy);

    if (overlapX > 0 && overlapY > 0) {
      if (overlapX < overlapY) {
        player.x += dx > 0 ? overlapX : -overlapX;
      } else {
        player.y += dy > 0 ? overlapY : -overlapY;
      }
    }
  }
}
