import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { PLACEHOLDER_COLORS } from '../config';

let dialogFrameTexture: Texture = Texture.EMPTY;

// Must resolve before the first buildDialogFrameVisual() call — bootstrap() awaits this
// alongside loadServerTextures/loadAntivirusTextures/loadPlayerTextures.
export async function loadDialogTextures(): Promise<void> {
  const texture = await Assets.load('/assets/dialog.png');
  texture.source.scaleMode = 'nearest';
  dialogFrameTexture = texture;
}

// The dialog.png art asset (720x130) replaces the placeholder rounded-rect panel below —
// the box's own border/shadow is baked into the art, text is laid out over it via the
// offsets in dialogBox.ts.
export function buildDialogFrameVisual(): Container {
  return new Sprite(dialogFrameTexture);
}

export function buildDialogPanelVisual(width: number, height: number): Container {
  return new Graphics()
    .roundRect(0, 0, width, height, 10)
    .fill(PLACEHOLDER_COLORS.dialogPanel)
    .stroke({ width: 2, color: PLACEHOLDER_COLORS.dialogPanelBorder });
}
