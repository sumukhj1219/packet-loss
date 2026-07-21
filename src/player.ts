import { PLAYER_SPRINT_SPEED, STAMINA_DRAIN_PER_SECOND, STAMINA_MAX, STAMINA_REGEN_PER_SECOND } from './config';
import type { FacingDirection, PlayerComponent } from './types';

// SECTION 1.3.1 — IDLE <-> MOVING transitions + 4-direction facing.
// PATCHING owns velocity/facing while facingLocked is true (wired in Milestone 3).
export function updatePlayerMovement(
  player: PlayerComponent,
  axis: { x: number; y: number },
  deltaSeconds: number,
  sprintHeld: boolean,
): void {
  if (player.facingLocked) return;

  // Sprint only actually engages while moving and stamina remains — holding Shift while
  // stationary, or with an empty tank, is a no-op rather than draining/blocking anything.
  const wantsToMove = axis.x !== 0 || axis.y !== 0;
  const isSprinting = sprintHeld && wantsToMove && player.stamina > 0;

  player.stamina = isSprinting
    ? Math.max(0, player.stamina - STAMINA_DRAIN_PER_SECOND * deltaSeconds)
    : Math.min(STAMINA_MAX, player.stamina + STAMINA_REGEN_PER_SECOND * deltaSeconds);

  const speed = isSprinting ? PLAYER_SPRINT_SPEED : player.speed;
  player.velocityX = axis.x * speed;
  player.velocityY = axis.y * speed;

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
