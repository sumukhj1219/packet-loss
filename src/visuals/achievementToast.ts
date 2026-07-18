import { Container, Graphics, Text } from 'pixi.js';
import { PLACEHOLDER_COLORS } from '../config';

const TOAST_DURATION_MS = 5000;
const TOAST_FADE_MS = 500;
const TOAST_WIDTH = 320;
const TOAST_HEIGHT = 56;

export interface AchievementToast {
  container: Container;
  show(label: string): void;
  /** Advance the toast's lifetime; returns true while still visible. */
  update(deltaMs: number): boolean;
}

export function buildAchievementToast(roomWidth: number): AchievementToast {
  const container = new Container();
  container.x = (roomWidth - TOAST_WIDTH) / 2;
  container.y = 16;
  container.visible = false;

  const panel = new Graphics()
    .roundRect(0, 0, TOAST_WIDTH, TOAST_HEIGHT, 10)
    .fill(PLACEHOLDER_COLORS.dialogPanel)
    .stroke({ width: 2, color: 0xffd24f });
  container.addChild(panel);

  const title = new Text({
    text: 'ACHIEVEMENT UNLOCKED',
    style: { fill: 0xffd24f, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 'bold' },
  });
  title.x = 16;
  title.y = 8;
  container.addChild(title);

  const label = new Text({
    text: '',
    style: { fill: 0xffffff, fontSize: 17, fontFamily: 'sans-serif' },
  });
  label.x = 16;
  label.y = 28;
  container.addChild(label);

  let remainingMs = 0;

  function show(text: string): void {
    label.text = text;
    container.visible = true;
    container.alpha = 1;
    remainingMs = TOAST_DURATION_MS;
  }

  function update(deltaMs: number): boolean {
    if (!container.visible) return false;

    remainingMs -= deltaMs;
    if (remainingMs <= 0) {
      container.visible = false;
      return false;
    }

    container.alpha = remainingMs < TOAST_FADE_MS ? remainingMs / TOAST_FADE_MS : 1;
    return true;
  }

  return { container, show, update };
}
