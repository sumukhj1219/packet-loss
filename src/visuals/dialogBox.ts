import { Container, Text } from 'pixi.js';
import type { DialogEvent } from '../types';
import { buildAlertAvatarVisual, buildDialogPanelVisual, buildGuideAvatarVisual } from './dialogVisual';

const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 110;
const PANEL_PADDING = 20;
const AVATAR_OFFSET_X = 48;

export interface DialogBox {
  container: Container;
  setEvent(event: DialogEvent | null): void;
}

export function buildDialogBox(roomWidth: number, roomHeight: number): DialogBox {
  const container = new Container();
  container.x = (roomWidth - PANEL_WIDTH) / 2;
  container.y = roomHeight - PANEL_HEIGHT - 24;
  container.visible = false;

  const panel = buildDialogPanelVisual(PANEL_WIDTH, PANEL_HEIGHT);
  container.addChild(panel);

  const guideAvatar = buildGuideAvatarVisual();
  guideAvatar.x = PANEL_PADDING + AVATAR_OFFSET_X;
  guideAvatar.y = PANEL_HEIGHT / 2;
  container.addChild(guideAvatar);

  const alertAvatar = buildAlertAvatarVisual();
  alertAvatar.x = PANEL_PADDING + AVATAR_OFFSET_X;
  alertAvatar.y = PANEL_HEIGHT / 2;
  container.addChild(alertAvatar);

  const textX = PANEL_PADDING * 2 + AVATAR_OFFSET_X * 2;
  const messageText = new Text({
    text: '',
    style: {
      fill: 0xffffff,
      fontSize: 16,
      fontFamily: 'sans-serif',
      wordWrap: true,
      wordWrapWidth: PANEL_WIDTH - textX - PANEL_PADDING,
    },
  });
  messageText.x = textX;
  messageText.y = PANEL_PADDING;
  container.addChild(messageText);

  const hintText = new Text({
    text: 'Press any key or click to continue',
    style: { fill: 0x6b7280, fontSize: 12, fontFamily: 'sans-serif' },
  });
  hintText.x = textX;
  hintText.y = PANEL_HEIGHT - PANEL_PADDING - 14;
  container.addChild(hintText);

  function setEvent(event: DialogEvent | null): void {
    container.visible = event !== null;
    if (!event) return;

    messageText.text = event.text;
    guideAvatar.visible = event.portrait === 'guide';
    alertAvatar.visible = event.portrait === 'alert';
    hintText.text = event.pausesSimulation ? 'Press ENTER to continue' : 'Press any key or click to continue';
  }

  return { container, setEvent };
}
