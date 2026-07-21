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

// The leaderboard view fills nearly the entire room canvas (not just a small centered
// card) so it reads as its own full-screen scene rather than a popup — LB_MARGIN is the
// gap kept to the room edges.
const LB_MARGIN = 32;
const LB_PANEL_PADDING = 32;
const LB_ROW_HEIGHT = 32;
const LB_MAX_ROWS = 15;
// Vertical rhythm from the panel's top-left corner down to the row table.
const LB_TITLE_GAP = 56; // panel top -> header baseline
const LB_HEADER_TO_ROWS_GAP = 34; // header -> first row
const LB_BACK_BUTTON_OFFSET = 45; // panel bottom -> Back button center

// Column x-offset (rank stays at the left edge, name column starts here). The score
// column is right-aligned against the content's right edge, computed per-instance below
// since it depends on roomWidth.
const COL_NAME_X = 80;

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

  // Full-screen panel — fills the room canvas edge-to-edge (minus LB_MARGIN), reusing the
  // same rounded-rect + border treatment as the dialog box and achievement toast so it
  // still reads as part of the same UI language rather than a bare full-bleed rect.
  const panelWidth = roomWidth - LB_MARGIN * 2;
  const panelHeight = roomHeight - LB_MARGIN * 2;
  const panelX = LB_MARGIN;
  const panelY = LB_MARGIN;
  // Left edge every piece of content anchors to, and the available content width used to
  // right-align the SCORE column — everything below is positioned from this left corner
  // rather than centered, so the table reads left-to-right like a real scoreboard.
  const contentX = panelX + LB_PANEL_PADDING;
  const contentWidth = panelWidth - LB_PANEL_PADDING * 2;

  const lbPanel = buildDialogPanelVisual(panelWidth, panelHeight);
  lbPanel.x = panelX;
  lbPanel.y = panelY;
  leaderboardView.addChild(lbPanel);

  const lbTitle = new Text({
    text: 'LEADERBOARD',
    style: { fill: 0x4fa8ff, fontSize: 36, fontFamily: 'sans-serif', fontWeight: 'bold' },
  });
  lbTitle.anchor.set(0, 0);
  lbTitle.x = contentX;
  lbTitle.y = panelY + LB_PANEL_PADDING;
  leaderboardView.addChild(lbTitle);

  const headerContainer = new Container();
  headerContainer.x = contentX;
  headerContainer.y = panelY + LB_PANEL_PADDING + LB_TITLE_GAP;
  leaderboardView.addChild(headerContainer);

  const headerStyle = { fill: 0x8a8f98, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' as const };
  const rankHeader = new Text({ text: 'RANK', style: headerStyle });
  rankHeader.anchor.set(0, 0.5);
  rankHeader.x = 0;
  headerContainer.addChild(rankHeader);

  const nameHeader = new Text({ text: 'PLAYER', style: headerStyle });
  nameHeader.anchor.set(0, 0.5);
  nameHeader.x = COL_NAME_X;
  headerContainer.addChild(nameHeader);

  const scoreHeader = new Text({ text: 'SCORE', style: headerStyle });
  scoreHeader.anchor.set(1, 0.5);
  scoreHeader.x = contentWidth;
  headerContainer.addChild(scoreHeader);

  const headerDivider = new Graphics().rect(0, 12, contentWidth, 1).fill({ color: 0x8a8f98, alpha: 0.3 });
  headerContainer.addChild(headerDivider);

  const rowsContainer = new Container();
  rowsContainer.x = contentX;
  rowsContainer.y = headerContainer.y + LB_HEADER_TO_ROWS_GAP;
  leaderboardView.addChild(rowsContainer);

  const statusText = new Text({
    text: '',
    style: { fill: 0x8a8f98, fontSize: 16, fontFamily: 'sans-serif' },
  });
  statusText.anchor.set(0, 0.5);
  statusText.x = contentX;
  statusText.y = rowsContainer.y + 10;
  leaderboardView.addChild(statusText);

  const back = buildButton('BACK', 140);
  back.root.x = roomWidth / 2;
  back.root.y = panelY + panelHeight - LB_BACK_BUTTON_OFFSET;
  leaderboardView.addChild(back.root);

  function renderRow(row: LeaderboardRow, index: number): void {
    const rowRoot = new Container();
    rowRoot.y = index * LB_ROW_HEIGHT;

    // Zebra striping so a 15-row table stays scannable at a glance, matching column width.
    if (index % 2 === 1) {
      const stripe = new Graphics()
        .rect(0, -LB_ROW_HEIGHT / 2, contentWidth, LB_ROW_HEIGHT)
        .fill({ color: 0xffffff, alpha: 0.03 });
      rowRoot.addChild(stripe);
    }

    const rankColor = RANK_COLORS[row.rank] ?? RANK_DEFAULT_COLOR;
    const rankText = new Text({
      text: `#${row.rank}`,
      style: { fill: rankColor, fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    rankText.anchor.set(0, 0.5);
    rankText.x = 0;
    rowRoot.addChild(rankText);

    const nameText = new Text({
      text: row.username.length > 24 ? `${row.username.slice(0, 23)}…` : row.username,
      style: { fill: 0xffffff, fontSize: 16, fontFamily: 'monospace' },
    });
    nameText.anchor.set(0, 0.5);
    nameText.x = COL_NAME_X;
    rowRoot.addChild(nameText);

    const scoreText = new Text({
      text: String(row.score),
      style: { fill: 0xffffff, fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    scoreText.anchor.set(1, 0.5);
    scoreText.x = contentWidth;
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
