import { Container, Graphics } from 'pixi.js';
import { PLACEHOLDER_COLORS } from '../config';
import type { FacingDirection, PlayerComponent } from '../types';

// SECTION 4.2 — Player Placeholder Visual
export function buildPlayerVisual(): Container {
  const root = new Container();

  const body = new Graphics()
    .circle(0, 0, 24)
    .fill(PLACEHOLDER_COLORS.player.IDLE);
  body.label = 'body';

  // facing indicator: a small triangle "nose" pointing in the current direction
  const facingMarker = new Graphics()
    .poly([0, -8, 10, 0, 0, 8])
    .fill(0xffffff);
  facingMarker.label = 'facingMarker';
  facingMarker.x = 24; // default: pointing RIGHT

  root.addChild(body, facingMarker);
  return root;
}

// SECTION 4.3 — Player State -> Visual Update
const FACING_ANGLE: Record<FacingDirection, number> = {
  RIGHT: 0,
  DOWN: Math.PI / 2,
  LEFT: Math.PI,
  UP: -Math.PI / 2,
};

export function updatePlayerVisual(player: PlayerComponent): void {
  const body = player.visual.getChildByLabel('body') as Graphics;
  const marker = player.visual.getChildByLabel('facingMarker') as Graphics;

  body.tint = PLACEHOLDER_COLORS.player[player.currentState];

  // rotate the facing marker around the body instead of flipping scale.x —
  // shapes don't need the LEFT-mirror trick real sprites would use
  const angle = FACING_ANGLE[player.facing];
  marker.x = Math.cos(angle) * 24;
  marker.y = Math.sin(angle) * 24;
  marker.rotation = angle;

  // simple "activity" cue while no walk-cycle frames exist: pulse scale slightly during MOVING
  body.scale.set(player.currentState === 'MOVING' ? 1.08 : 1.0);
}
