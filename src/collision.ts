import { ROOM_HEIGHT, ROOM_WIDTH, SERVER_FOOTPRINT } from './config';
import type { PlayerComponent, ServerComponent } from './types';

// SECTION 1.6 — Player movement clamping (room walls)
export function clampToRoom(player: PlayerComponent): void {
  player.x = Math.max(player.boundingRadius, Math.min(ROOM_WIDTH - player.boundingRadius, player.x));
  player.y = Math.max(player.boundingRadius, Math.min(ROOM_HEIGHT - player.boundingRadius, player.y));
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
