import { Container, Text } from 'pixi.js';
import { playDialogSfx } from '../audio';
import type { DialogEvent } from '../types';
import { buildDialogFrameVisual } from './dialogVisual';

// Matches public/assets/dialog.png (720x130) — text area offsets measured from the art.
const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 130;
const TEXT_OFFSET_X = 129;
const TEXT_OFFSET_Y = 39;
const TEXT_WIDTH = 547;
const TEXT_HEIGHT = 59;

export interface DialogBox {
  container: Container;
  setEvent(event: DialogEvent | null): void;
}

export function buildDialogBox(roomWidth: number, roomHeight: number): DialogBox {
  const container = new Container();
  container.x = (roomWidth - PANEL_WIDTH) / 2;
  container.y = roomHeight - PANEL_HEIGHT - 24;
  container.visible = false;

  const panel = buildDialogFrameVisual();
  container.addChild(panel);

  const messageText = new Text({
    text: '',
    style: {
      fill: 0xffffff,
      fontSize: 13,
      fontFamily: 'sans-serif',
      wordWrap: true,
      wordWrapWidth: TEXT_WIDTH,
    },
  });
  messageText.x = TEXT_OFFSET_X;
  messageText.y = TEXT_OFFSET_Y;
  container.addChild(messageText);

  const hintText = new Text({
    text: 'Press any key or click to continue',
    style: { fill: 0x6b7280, fontSize: 10, fontFamily: 'sans-serif' },
  });
  hintText.x = TEXT_OFFSET_X;
  hintText.y = TEXT_OFFSET_Y + TEXT_HEIGHT - 14;
  container.addChild(hintText);

  let currentEvent: DialogEvent | null = null;

  function setEvent(event: DialogEvent | null): void {
    container.visible = event !== null;
    if (!event) {
      currentEvent = null;
      return;
    }

    // setEvent is called every ticker frame with whatever's active — only (re)play the sfx
    // and update text when a genuinely new dialog appears, not on every frame it's on screen.
    if (event === currentEvent) return;
    currentEvent = event;

    messageText.text = event.text;
    messageText.style.fill = event.portrait === 'alert' ? 0x4ade80 : 0xffffff;
    hintText.text = event.pausesSimulation ? 'Press ENTER to continue' : 'Press any key or click to continue';
    playDialogSfx();
  }

  return { container, setEvent };
}
