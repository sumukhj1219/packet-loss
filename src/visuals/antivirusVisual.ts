import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Texture } from 'pixi.js';
import { PLACEHOLDER_COLORS } from '../config';
import type { GameState } from '../types';

const FRAME_SIZE = 60;
const FRAME_COUNT = 10;

let towerTextures: Texture[] = [];

// Slices public/assets/tower.png (600x60, 10 frames of 60x60) into the tower's idle/active
// loop. Must resolve before the first buildAntivirusVisual() call — bootstrap() awaits this
// ahead of the first startRun(), same as loadServerTextures.
export async function loadAntivirusTextures(): Promise<void> {
  const sheet = await Assets.load('/assets/tower.png');
  sheet.source.scaleMode = 'nearest';

  towerTextures = Array.from(
    { length: FRAME_COUNT },
    (_, i) => new Texture({ source: sheet.source, frame: new Rectangle(i * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE) }),
  );
}

// AOE ring (radius, placeholder) plus the tower body sprite, looping continuously for as
// long as the tower is alive.
export function buildAntivirusVisual(): Container {
  const container = new Container();
  container.label = 'antivirusTower';
  container.visible = false;

  const ring = new Graphics();
  ring.label = 'ring';

  const body = new AnimatedSprite(towerTextures);
  body.label = 'body';
  body.anchor.set(0.5);
  body.animationSpeed = 0.15;
  body.loop = true;
  body.play();

  container.addChild(ring, body);
  return container;
}

export function updateAntivirusVisual(visual: Container, state: GameState): void {
  const tower = state.antivirusTower;
  const wasVisible = visual.visible;
  visual.visible = tower !== null;
  if (!tower) return;

  visual.position.set(tower.worldX, tower.worldY);

  // Fresh loop from frame 0 on every new placement, not a continuation from wherever the
  // last tower's animation happened to stop.
  if (!wasVisible) {
    const body = visual.getChildByLabel('body') as AnimatedSprite;
    body.gotoAndPlay(0);
  }

  const ring = visual.getChildByLabel('ring') as Graphics;
  ring
    .clear()
    .circle(0, 0, tower.radius)
    .fill({ color: PLACEHOLDER_COLORS.immunityRing, alpha: 0.08 })
    .circle(0, 0, tower.radius)
    .stroke({ width: 3, color: PLACEHOLDER_COLORS.immunityRing, alpha: 0.9 });
}
