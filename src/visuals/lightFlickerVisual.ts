import { Graphics } from 'pixi.js';
import { LIGHT_FLICKER_DURATION_MS } from '../lightFlicker';

// Each individual blackout holds for ~1.5s with a shorter gap back to normal in between,
// repeating for the whole 10s event — a slow, readable flicker rather than a rapid strobe.
const FLASH_ALPHA = 0.85;
const FLASH_ON_MS = 1500;
const FLASH_OFF_MS = 1000;
const FLASH_CYCLE_MS = FLASH_ON_MS + FLASH_OFF_MS;

// Full-room black overlay, sized to match ROOM_WIDTH x ROOM_HEIGHT like gameOverScreen's own
// overlay — added as the topmost stage child so the flicker reads across everything, dialog
// box included, the way a real room light flickering would affect the whole scene.
export function buildLightFlickerOverlay(roomWidth: number, roomHeight: number): Graphics {
  const overlay = new Graphics().rect(0, 0, roomWidth, roomHeight).fill(0x000000);
  overlay.alpha = 0;
  overlay.eventMode = 'none';
  overlay.label = 'lightFlickerOverlay';
  return overlay;
}

export function updateLightFlickerVisual(overlay: Graphics, remainingMs: number): void {
  if (remainingMs <= 0) {
    overlay.alpha = 0;
    return;
  }

  const elapsed = LIGHT_FLICKER_DURATION_MS - remainingMs;
  overlay.alpha = elapsed % FLASH_CYCLE_MS < FLASH_ON_MS ? FLASH_ALPHA : 0;
}
