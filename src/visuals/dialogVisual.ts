import { Container, Graphics } from 'pixi.js';
import { PLACEHOLDER_COLORS } from '../config';

// SECTION 4.6 — Guide Avatar & Dialog Panel Placeholders
export function buildGuideAvatarVisual(): Container {
  return new Graphics().circle(0, 0, 28).fill(PLACEHOLDER_COLORS.guideAvatar);
}

// Not an explicit PRD builder — the 'alert' portrait (Section 1.4) needs its own
// placeholder distinct from 'guide', reusing the INFECTED red for the "something's
// wrong" read.
export function buildAlertAvatarVisual(): Container {
  return new Graphics().circle(0, 0, 28).fill(PLACEHOLDER_COLORS.server.INFECTED);
}

export function buildDialogPanelVisual(width: number, height: number): Container {
  return new Graphics()
    .roundRect(0, 0, width, height, 10)
    .fill(PLACEHOLDER_COLORS.dialogPanel)
    .stroke({ width: 2, color: PLACEHOLDER_COLORS.dialogPanelBorder });
}
