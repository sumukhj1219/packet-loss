import { Container, Graphics, Text } from 'pixi.js';
import { CONNECTION_LAG_TELEGRAPH_MS } from '../connectionLag';

// Non-blocking warning banner — unlike dialogBox.ts's panel, gameplay keeps running underneath
// this the whole time it's visible; it never touches state.dialog/isBlockingInput.
const BANNER_WIDTH = 360;
const BANNER_HEIGHT = 56;
const BANNER_TOP_MARGIN = 32; // px from the top of the room
const BANNER_BG_COLOR = 0x1c1e26; // matches PLACEHOLDER_COLORS.dialogPanel
const BANNER_ACCENT_COLOR = 0xff2e4d; // matches PLACEHOLDER_COLORS.server.INFECTED — reads as danger
const FADE_MS = 150; // fade in/out over this much of the telegraph window's start/end

export function buildConnectionLagBanner(roomWidth: number): Container {
  const container = new Container();
  container.x = (roomWidth - BANNER_WIDTH) / 2;
  container.y = BANNER_TOP_MARGIN;
  container.alpha = 0;
  container.eventMode = 'none';
  container.label = 'connectionLagBanner';

  const panel = new Graphics()
    .roundRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT, 10)
    .fill(BANNER_BG_COLOR)
    .stroke({ width: 2, color: BANNER_ACCENT_COLOR });
  container.addChild(panel);

  const text = new Text({
    text: 'CONNECTION UNSTABLE',
    style: {
      fill: BANNER_ACCENT_COLOR,
      fontSize: 18,
      fontFamily: 'Modak',
      fontWeight: 'bold',
      stroke: { color: BANNER_BG_COLOR, width: 0.9 },
    },
  });
  text.anchor.set(0.5);
  text.x = BANNER_WIDTH / 2;
  text.y = BANNER_HEIGHT / 2;
  container.addChild(text);

  return container;
}

export function updateConnectionLagBanner(banner: Container, telegraphRemainingMs: number): void {
  if (telegraphRemainingMs <= 0) {
    banner.alpha = 0;
    return;
  }

  const elapsed = CONNECTION_LAG_TELEGRAPH_MS - telegraphRemainingMs;
  const fadeIn = Math.min(1, elapsed / FADE_MS);
  const fadeOut = Math.min(1, telegraphRemainingMs / FADE_MS);
  banner.alpha = Math.min(fadeIn, fadeOut);
}
