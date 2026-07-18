import { Container, Graphics } from 'pixi.js';
import { PLACEHOLDER_COLORS } from '../config';
import type { ServerComponent } from '../types';

// SECTION 4.4 — Server Placeholder Visual
export function buildServerVisual(): Container {
  const root = new Container();

  const body = new Graphics()
    .roundRect(-30, -30, 60, 60, 6)
    .fill(PLACEHOLDER_COLORS.server.IDLE);
  body.label = 'body';

  const lockGlyph = new Graphics()
    .roundRect(-8, -2, 16, 12, 2)
    .fill(PLACEHOLDER_COLORS.lockGlyph)
    .circle(0, -2, 6)
    .stroke({ width: 3, color: PLACEHOLDER_COLORS.lockGlyph });
  lockGlyph.label = 'lockGlyph';
  lockGlyph.visible = false;

  root.addChild(body, lockGlyph);
  return root;
}

export function buildImmunityRingVisual(): Container {
  const ring = new Graphics()
    .circle(0, 0, 40)
    .stroke({ width: 4, color: PLACEHOLDER_COLORS.immunityRing, alpha: 0.85 });
  ring.visible = false;
  return ring;
}

// SECTION 4.5 — Server State -> Visual Update
export function updateServerVisual(server: ServerComponent, elapsedMs: number): void {
  const body = server.visual.getChildByLabel('body') as Graphics;
  const lockGlyph = server.visual.getChildByLabel('lockGlyph') as Graphics;

  body.tint = PLACEHOLDER_COLORS.server[server.state];
  lockGlyph.visible = server.state === 'LOCKED';

  if (server.overlayVisual) {
    server.overlayVisual.visible = server.state === 'IMMUNE';
  }

  // INFECTED flashing: ticker-driven alpha oscillator, stops immediately once patched.
  body.alpha = server.state === 'INFECTED' ? 0.6 + Math.sin(elapsedMs / 150) * 0.4 : 1;
}
