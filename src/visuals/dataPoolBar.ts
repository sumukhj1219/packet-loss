import {
  DATA_POOL_SLOT_COUNT,
  DATA_POOL_SLOT_HEIGHT,
  DATA_POOL_SLOT_WIDTH,
  DATA_POOL_TIER_EMPTY_RATIO,
  DATA_POOL_TIER_HALF_RATIO,
} from '../config';
import type { GameState } from '../types';

const TEXTURE_FULL = '/assets/data-full.png';
const TEXTURE_HALF = '/assets/data-half.png';
const TEXTURE_EMPTY = '/assets/data-empty.png';

// Side-screen Data Pool meter — plain DOM <img> slots, not Pixi, since the side screen
// (index.html #dataScreen) is an HTML overlay, not the game canvas. Lives outside the
// canvas's ticker; caller drives updateDataPoolBar() from the same loop as updateDataScreen.
export function buildDataPoolBar(container: HTMLDivElement): HTMLImageElement[] {
  container.innerHTML = '';
  const slots: HTMLImageElement[] = [];

  for (let i = 0; i < DATA_POOL_SLOT_COUNT; i++) {
    const img = document.createElement('img');
    img.width = DATA_POOL_SLOT_WIDTH;
    img.height = DATA_POOL_SLOT_HEIGHT;
    img.style.imageRendering = 'pixelated';
    img.style.display = 'none';
    container.appendChild(img);
    slots.push(img);
  }

  return slots;
}

export function updateDataPoolBar(slots: HTMLImageElement[], state: GameState): void {
  const ratio = state.dataPool / state.maxDataPool;
  const tierSrc =
    ratio > DATA_POOL_TIER_HALF_RATIO ? TEXTURE_FULL : ratio > DATA_POOL_TIER_EMPTY_RATIO ? TEXTURE_HALF : TEXTURE_EMPTY;
  const slotValue = state.maxDataPool / DATA_POOL_SLOT_COUNT;
  const filledSlots = Math.min(DATA_POOL_SLOT_COUNT, Math.floor(state.dataPool / slotValue));

  for (let i = 0; i < slots.length; i++) {
    const img = slots[i];
    if (i < filledSlots) {
      if (img.style.display === 'none') img.style.display = '';
      if (!img.src.endsWith(tierSrc)) img.src = tierSrc;
    } else if (img.style.display !== 'none') {
      img.style.display = 'none';
    }
  }
}
