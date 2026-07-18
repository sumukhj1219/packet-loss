import { Graphics } from 'pixi.js';
import { PLACEHOLDER_COLORS } from '../config';
import type { GameState } from '../types';

// Placeholder — no dedicated art yet. Reuses the immunity-ring color/language so it reads
// as "protected zone" consistently with the per-server immunity ring.
export function buildAntivirusVisual(): Graphics {
  const visual = new Graphics();
  visual.label = 'antivirusTower';
  visual.visible = false;
  return visual;
}

export function updateAntivirusVisual(visual: Graphics, state: GameState): void {
  const tower = state.antivirusTower;
  visual.visible = tower !== null;
  if (!tower) return;

  visual.position.set(tower.worldX, tower.worldY);
  visual
    .clear()
    .circle(0, 0, tower.radius)
    .fill({ color: PLACEHOLDER_COLORS.immunityRing, alpha: 0.08 })
    .circle(0, 0, tower.radius)
    .stroke({ width: 3, color: PLACEHOLDER_COLORS.immunityRing, alpha: 0.9 });
}
