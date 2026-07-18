import type { FacingDirection, PlayerComponent } from './types';

// SECTION 1.3.1 — IDLE <-> MOVING transitions + 4-direction facing.
// PATCHING owns velocity/facing while facingLocked is true (wired in Milestone 3).
export function updatePlayerMovement(
  player: PlayerComponent,
  axis: { x: number; y: number },
  deltaSeconds: number,
): void {
  if (player.facingLocked) return;

  player.velocityX = axis.x * player.speed;
  player.velocityY = axis.y * player.speed;

  const wasMoving = player.currentState === 'MOVING';
  const isMoving = player.velocityX !== 0 || player.velocityY !== 0;

  if (isMoving && !wasMoving) player.currentState = 'MOVING';
  if (!isMoving && wasMoving) player.currentState = 'IDLE';

  if (isMoving) {
    player.facing = dominantFacing(player.velocityX, player.velocityY);
  }

  player.x += player.velocityX * deltaSeconds;
  player.y += player.velocityY * deltaSeconds;
}

function dominantFacing(vx: number, vy: number): FacingDirection {
  if (Math.abs(vx) > Math.abs(vy)) {
    return vx > 0 ? 'RIGHT' : 'LEFT';
  }
  return vy > 0 ? 'DOWN' : 'UP';
}
