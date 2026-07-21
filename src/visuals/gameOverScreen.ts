import { Container, Graphics, Text } from 'pixi.js';
import type { LeaderboardRow } from '../wavedashIntegration';
import { buildDialogPanelVisual } from './dialogVisual';

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
const LB_PANEL_PADDING = 24;
const LB_ROW_HEIGHT = 26;
const LB_MAX_ROWS = 10;
const LB_ROW_START_Y = -140;
const LB_HEADER_Y = LB_ROW_START_Y - 24;
// Backing panel spans from just above the column header down past the last possible row.
const LB_PANEL_TOP = LB_HEADER_Y - 20;
const LB_PANEL_HEIGHT = LB_ROW_START_Y - LB_PANEL_TOP + LB_MAX_ROWS * LB_ROW_HEIGHT + 44;

// Shared column x-offsets (relative to rowsContainer's centered origin) so the header
// labels and every row's cells line up on the same three columns instead of the header
// being one hand-spaced string hoping to land above the real cells.
const COL_RANK_X = -LB_PANEL_WIDTH / 2 + LB_PANEL_PADDING;
const COL_NAME_X = COL_RANK_X + 56;
const COL_SCORE_X = LB_PANEL_WIDTH / 2 - LB_PANEL_PADDING;

// Medal reads for the top 3 ranks; everything else stays the neutral rank color.
const RANK_COLORS: Record<number, number> = { 1: 0xffd24f, 2: 0xc8ccd4, 3: 0xcd7f32 };
const RANK_DEFAULT_COLOR = 0x8a8f98;

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

  // Backing panel — reuses the same rounded-rect + border treatment as the dialog box
  // and achievement toast so the leaderboard reads as one more panel in the same UI
  // language, instead of bare text floating over the dimmed overlay.
  const lbPanel = buildDialogPanelVisual(LB_PANEL_WIDTH + LB_PANEL_PADDING * 2, LB_PANEL_HEIGHT);
  lbPanel.x = roomWidth / 2 - (LB_PANEL_WIDTH + LB_PANEL_PADDING * 2) / 2;
  lbPanel.y = roomHeight / 2 + LB_PANEL_TOP;
  leaderboardView.addChild(lbPanel);

  const headerContainer = new Container();
  headerContainer.x = roomWidth / 2;
  headerContainer.y = roomHeight / 2 + LB_HEADER_Y;
  leaderboardView.addChild(headerContainer);

  const headerStyle = { fill: 0x8a8f98, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' as const };
  const rankHeader = new Text({ text: 'RANK', style: headerStyle });
  rankHeader.anchor.set(0, 0.5);
  rankHeader.x = COL_RANK_X;
  headerContainer.addChild(rankHeader);

  const nameHeader = new Text({ text: 'PLAYER', style: headerStyle });
  nameHeader.anchor.set(0, 0.5);
  nameHeader.x = COL_NAME_X;
  headerContainer.addChild(nameHeader);

  const scoreHeader = new Text({ text: 'SCORE', style: headerStyle });
  scoreHeader.anchor.set(1, 0.5);
  scoreHeader.x = COL_SCORE_X;
  headerContainer.addChild(scoreHeader);

  const headerDivider = new Graphics()
    .rect(-LB_PANEL_WIDTH / 2, 12, LB_PANEL_WIDTH, 1)
    .fill({ color: 0x8a8f98, alpha: 0.3 });
  headerContainer.addChild(headerDivider);

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

    // Zebra striping so a 10-row table stays scannable at a glance, matching column width.
    if (index % 2 === 1) {
      const stripe = new Graphics()
        .rect(-LB_PANEL_WIDTH / 2, -LB_ROW_HEIGHT / 2, LB_PANEL_WIDTH, LB_ROW_HEIGHT)
        .fill({ color: 0xffffff, alpha: 0.03 });
      rowRoot.addChild(stripe);
    }

    const rankColor = RANK_COLORS[row.rank] ?? RANK_DEFAULT_COLOR;
    const rankText = new Text({
      text: `#${row.rank}`,
      style: { fill: rankColor, fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    rankText.anchor.set(0, 0.5);
    rankText.x = COL_RANK_X;
    rowRoot.addChild(rankText);

    const nameText = new Text({
      text: row.username.length > 18 ? `${row.username.slice(0, 17)}…` : row.username,
      style: { fill: 0xffffff, fontSize: 15, fontFamily: 'monospace' },
    });
    nameText.anchor.set(0, 0.5);
    nameText.x = COL_NAME_X;
    rowRoot.addChild(nameText);

    const scoreText = new Text({
      text: String(row.score),
      style: { fill: 0xffffff, fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    scoreText.anchor.set(1, 0.5);
    scoreText.x = COL_SCORE_X;
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
    headerContainer.visible = false;
  }

  function showLeaderboardRows(rows: LeaderboardRow[]): void {
    clearRows();
    headerContainer.visible = true;
    if (rows.length === 0) {
      statusText.text = 'No entries yet.';
      return;
    }
    statusText.text = '';
    rows.slice(0, LB_MAX_ROWS).forEach(renderRow);
  }

  function showLeaderboardError(message: string): void {
    clearRows();
    headerContainer.visible = false;
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
