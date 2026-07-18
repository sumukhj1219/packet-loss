import { Container, Graphics, Text } from 'pixi.js';
import type { LeaderboardRow } from '../wavedashIntegration';

export interface GameOverScreen {
  container: Container;
  setVisible(visible: boolean): void;
  setStats(totalPatches: number, elapsedMs: number): void;
  onRetry(cb: () => void): void;
  onViewLeaderboard(cb: () => void): void;
  showLeaderboardLoading(): void;
  showLeaderboardRows(rows: LeaderboardRow[]): void;
  showLeaderboardError(message: string): void;
}

const LB_PANEL_WIDTH = 480;
const LB_ROW_HEIGHT = 26;
const LB_MAX_ROWS = 10;
const LB_ROW_START_Y = -140;

function buildButton(label: string, width: number): { root: Container; hitArea: Graphics } {
  const root = new Container();

  const hitArea = new Graphics().roundRect(-width / 2, -24, width, 48, 8).fill(0x4fa8ff);
  hitArea.eventMode = 'static';
  hitArea.cursor = 'pointer';
  root.addChild(hitArea);

  const text = new Text({
    text: label,
    style: { fill: 0x0b0d12, fontSize: 18, fontFamily: 'sans-serif', fontWeight: 'bold' },
  });
  text.anchor.set(0.5);
  root.addChild(text);

  return { root, hitArea };
}

export function buildGameOverScreen(roomWidth: number, roomHeight: number): GameOverScreen {
  const container = new Container();
  container.visible = false;

  const overlay = new Graphics().rect(0, 0, roomWidth, roomHeight).fill({ color: 0x000000, alpha: 0.75 });
  container.addChild(overlay);

  // --- main view: title, stats, Retry + View Leaderboard buttons ---
  const mainView = new Container();
  container.addChild(mainView);

  const title = new Text({
    text: 'GAME OVER',
    style: { fill: 0xff2e4d, fontSize: 48, fontFamily: 'sans-serif', fontWeight: 'bold' },
  });
  title.anchor.set(0.5);
  title.x = roomWidth / 2;
  title.y = roomHeight / 2 - 90;
  mainView.addChild(title);

  const stats = new Text({
    text: '',
    style: { fill: 0xffffff, fontSize: 20, fontFamily: 'monospace', align: 'center' },
  });
  stats.anchor.set(0.5);
  stats.x = roomWidth / 2;
  stats.y = roomHeight / 2 - 10;
  mainView.addChild(stats);

  const retry = buildButton('RETRY', 180);
  retry.root.x = roomWidth / 2 - 110;
  retry.root.y = roomHeight / 2 + 70;
  mainView.addChild(retry.root);

  const viewLeaderboard = buildButton('LEADERBOARD', 180);
  viewLeaderboard.root.x = roomWidth / 2 + 110;
  viewLeaderboard.root.y = roomHeight / 2 + 70;
  mainView.addChild(viewLeaderboard.root);

  // --- leaderboard view: table of entries + Back button ---
  const leaderboardView = new Container();
  leaderboardView.visible = false;
  container.addChild(leaderboardView);

  const lbTitle = new Text({
    text: 'LEADERBOARD',
    style: { fill: 0x4fa8ff, fontSize: 32, fontFamily: 'sans-serif', fontWeight: 'bold' },
  });
  lbTitle.anchor.set(0.5, 0);
  lbTitle.x = roomWidth / 2;
  lbTitle.y = roomHeight / 2 - 190;
  leaderboardView.addChild(lbTitle);

  const lbHeader = new Text({
    text: 'RANK   PLAYER                SCORE',
    style: { fill: 0x8a8f98, fontSize: 14, fontFamily: 'monospace' },
  });
  lbHeader.anchor.set(0.5, 0);
  lbHeader.x = roomWidth / 2;
  lbHeader.y = roomHeight / 2 + LB_ROW_START_Y - 24;
  leaderboardView.addChild(lbHeader);

  const rowsContainer = new Container();
  rowsContainer.x = roomWidth / 2;
  rowsContainer.y = roomHeight / 2 + LB_ROW_START_Y;
  leaderboardView.addChild(rowsContainer);

  const statusText = new Text({
    text: '',
    style: { fill: 0x8a8f98, fontSize: 16, fontFamily: 'sans-serif' },
  });
  statusText.anchor.set(0.5);
  statusText.x = roomWidth / 2;
  statusText.y = roomHeight / 2 + LB_ROW_START_Y + 20;
  leaderboardView.addChild(statusText);

  const back = buildButton('BACK', 140);
  back.root.x = roomWidth / 2;
  back.root.y = roomHeight / 2 + 190;
  leaderboardView.addChild(back.root);

  function renderRow(row: LeaderboardRow, index: number): void {
    const rowRoot = new Container();
    rowRoot.y = index * LB_ROW_HEIGHT;

    const rankText = new Text({
      text: `#${row.rank}`,
      style: { fill: 0xffd24f, fontSize: 15, fontFamily: 'monospace' },
    });
    rankText.anchor.set(0, 0.5);
    rankText.x = -LB_PANEL_WIDTH / 2;
    rowRoot.addChild(rankText);

    const nameText = new Text({
      text: row.username.length > 18 ? `${row.username.slice(0, 17)}…` : row.username,
      style: { fill: 0xffffff, fontSize: 15, fontFamily: 'monospace' },
    });
    nameText.anchor.set(0, 0.5);
    nameText.x = -LB_PANEL_WIDTH / 2 + 70;
    rowRoot.addChild(nameText);

    const scoreText = new Text({
      text: String(row.score),
      style: { fill: 0xffffff, fontSize: 15, fontFamily: 'monospace' },
    });
    scoreText.anchor.set(1, 0.5);
    scoreText.x = LB_PANEL_WIDTH / 2;
    rowRoot.addChild(scoreText);

    rowsContainer.addChild(rowRoot);
  }

  function clearRows(): void {
    rowsContainer.removeChildren();
  }

  function showLeaderboardLoading(): void {
    mainView.visible = false;
    leaderboardView.visible = true;
    clearRows();
    statusText.text = 'Loading…';
    lbHeader.visible = false;
  }

  function showLeaderboardRows(rows: LeaderboardRow[]): void {
    clearRows();
    lbHeader.visible = true;
    if (rows.length === 0) {
      statusText.text = 'No entries yet.';
      return;
    }
    statusText.text = '';
    rows.slice(0, LB_MAX_ROWS).forEach(renderRow);
  }

  function showLeaderboardError(message: string): void {
    clearRows();
    lbHeader.visible = false;
    statusText.text = `Couldn't load leaderboard: ${message}`;
  }

  function showMainView(): void {
    leaderboardView.visible = false;
    mainView.visible = true;
  }

  back.hitArea.on('pointertap', showMainView);

  function setVisible(visible: boolean): void {
    container.visible = visible;
    if (visible) showMainView();
  }

  function setStats(totalPatches: number, elapsedMs: number): void {
    const seconds = (elapsedMs / 1000).toFixed(1);
    stats.text = `Patches survived: ${totalPatches}\nTime survived: ${seconds}s`;
  }

  function onRetry(cb: () => void): void {
    retry.hitArea.on('pointertap', cb);
  }

  function onViewLeaderboard(cb: () => void): void {
    viewLeaderboard.hitArea.on('pointertap', cb);
  }

  return {
    container,
    setVisible,
    setStats,
    onRetry,
    onViewLeaderboard,
    showLeaderboardLoading,
    showLeaderboardRows,
    showLeaderboardError,
  };
}
