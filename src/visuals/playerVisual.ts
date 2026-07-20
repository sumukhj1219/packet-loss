import { AnimatedSprite, Assets, Container, Rectangle, Texture } from 'pixi.js';
import type { FacingDirection, PlayerComponent } from '../types';

// Slices public/assets/player.png (256x32) into 4 directional idle sets of 2 frames each,
// 32x32 per frame, laid out in a single row: front, back, left, right (in that order). No
// run/walk-cycle art exists — every PlayerState uses whichever directional set matches
// player.facing.
const FRAME_SIZE = 32;
const FRAMES_PER_DIRECTION = 2;

let frontTextures: Texture[] = [];
let backTextures: Texture[] = [];
let leftTextures: Texture[] = [];
let rightTextures: Texture[] = [];

// Must resolve before the first buildPlayerVisual() call — bootstrap() awaits this ahead of
// the first startRun(), same as loadServerTextures/loadAntivirusTextures.
export async function loadPlayerTextures(): Promise<void> {
  const sheet = await Assets.load('/assets/player.png');
  sheet.source.scaleMode = 'nearest';

  const sliceDirection = (index: number): Texture[] =>
    Array.from(
      { length: FRAMES_PER_DIRECTION },
      (_, i) => new Texture({ source: sheet.source, frame: new Rectangle((index * FRAMES_PER_DIRECTION + i) * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE) }),
    );

  frontTextures = sliceDirection(0);
  backTextures = sliceDirection(1);
  leftTextures = sliceDirection(2);
  rightTextures = sliceDirection(3);
}

function texturesForFacing(facing: FacingDirection): Texture[] {
  switch (facing) {
    case 'DOWN':
      return frontTextures;
    case 'UP':
      return backTextures;
    case 'LEFT':
      return leftTextures;
    case 'RIGHT':
      return rightTextures;
  }
}

// SECTION 4.2 — Player Visual
export function buildPlayerVisual(): Container {
  const root = new Container();

  const body = new AnimatedSprite(frontTextures);
  body.label = 'body';
  body.anchor.set(0.5);
  body.animationSpeed = 0.15;
  body.loop = true;
  body.play();

  root.addChild(body);
  return root;
}

// SECTION 4.3 — Player State -> Visual Update
export function updatePlayerVisual(player: PlayerComponent): void {
  const body = player.visual.getChildByLabel('body') as AnimatedSprite;

  // Reference-compare against the shared frame arrays so the animation only resets
  // (gotoAndPlay) on an actual facing change, not every tick.
  const desiredTextures = texturesForFacing(player.facing);
  if (body.textures !== desiredTextures) {
    body.textures = desiredTextures;
    body.gotoAndPlay(0);
  }
}
