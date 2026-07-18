import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Texture } from 'pixi.js';
import { PLACEHOLDER_COLORS } from '../config';
import type { ServerComponent } from '../types';

const FRAME_SIZE = 60;
const FRAMES_PER_SET = 6;

let idleTextures: Texture[] = [];
let infectedTextures: Texture[] = [];

// Slices public/assets/server.png (720x60, 12 frames of 60x60: frames 0-5 fresh/idle,
// 6-11 infected) into two animation-frame arrays. Must resolve before the first
// buildServerVisual() call — bootstrap() awaits this ahead of the first startRun().
export async function loadServerTextures(): Promise<void> {
  const sheet = await Assets.load('/assets/server.png');
  sheet.source.scaleMode = 'nearest';

  const frames: Texture[] = [];
  for (let i = 0; i < FRAMES_PER_SET * 2; i++) {
    frames.push(new Texture({ source: sheet.source, frame: new Rectangle(i * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE) }));
  }
  idleTextures = frames.slice(0, FRAMES_PER_SET);
  infectedTextures = frames.slice(FRAMES_PER_SET);
}

// SECTION 4.4 — Server Visual
export function buildServerVisual(): Container {
  const root = new Container();

  const body = new AnimatedSprite(idleTextures);
  body.label = 'body';
  body.anchor.set(0.5);
  body.animationSpeed = 0.15;
  body.play();
  // Random per-server mirror flip so identical racks don't all face the same way.
  body.scale.x = Math.random() < 0.5 ? 1 : -1;

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
  const body = server.visual.getChildByLabel('body') as AnimatedSprite;
  const lockGlyph = server.visual.getChildByLabel('lockGlyph') as Graphics;

  // Reference-compare against the shared frame arrays so the animation only resets
  // (gotoAndPlay) on an actual infected/fresh transition, not every tick.
  const desiredTextures = server.state === 'INFECTED' ? infectedTextures : idleTextures;
  if (body.textures !== desiredTextures) {
    body.textures = desiredTextures;
    body.gotoAndPlay(0);
  }

  lockGlyph.visible = server.state === 'LOCKED';

  if (server.overlayVisual) {
    server.overlayVisual.visible = server.state === 'IMMUNE';
  }

  // INFECTED flashing: ticker-driven alpha oscillator, stops immediately once patched.
  body.alpha = server.state === 'INFECTED' ? 0.6 + Math.sin(elapsedMs / 150) * 0.4 : 1;
}
