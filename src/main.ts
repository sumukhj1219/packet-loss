import { Application, Assets, Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { attemptPlaceAntivirusTower, updateAntivirusTower } from './antivirus';
import { startBackgroundMusic } from './audio';
import {
  PLACEHOLDER_COLORS,
  ROOM_BACKGROUND_COLOR,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  SIDE_SCREEN_WIDTH,
  STAMINA_MAX,
  WALL_THICKNESS,
} from './config';
import { clampToRoom, resolveServerCollisions } from './collision';
import { bootSequence, checkDialogTriggers, dismissActiveDialog, pumpDialogQueue } from './dialog';
import { consumeAntivirusPress, consumeInteractPress, getMovementAxis, initInput, isSprintHeld } from './input';
import { attemptPatch, findInteractableServer } from './interaction';
import { updateImmunityTimers, updatePatching } from './patch';
import { updatePlayerMovement } from './player';
import { checkTimeBasedAchievements, recordGameOverStats, recordGameStart, requestStatsOnBoot } from './stats';
import { createGameState } from './state';
import type { GameState } from './types';
import { buildAntivirusVisual, loadAntivirusTextures, updateAntivirusVisual } from './visuals/antivirusVisual';
import { buildDialogBox } from './visuals/dialogBox';
import { loadDialogTextures } from './visuals/dialogVisual';
import { buildGameOverScreen } from './visuals/gameOverScreen';
import { buildDataPoolBar, updateDataPoolBar } from './visuals/dataPoolBar';
import { buildInfectedGrid, updateInfectedGrid } from './visuals/infectedGrid';
import { loadPlayerTextures, updatePlayerVisual } from './visuals/playerVisual';
import { loadServerTextures, updateServerVisual } from './visuals/serverVisual';
import { triggerInitialOutbreak, VIRUS_TICK_MS, virusTick } from './virus';
import Wavedash from '@wvdsh/sdk-js';
import { fetchLeaderboardEntries, onGameOver } from './wavedashIntegration';
import './style.css';

// SECTION 5.1 — synchronous, not a promise: internally this signals the Wavedash host page
// to dismiss ITS OWN platform-level loading screen (the game is embedded in an iframe the
// host keeps hidden until init() fires) — nothing in our page, including the home screen
// below, is visible until this runs. Must happen at module load, not inside bootstrap(),
// or the Start button ends up hidden behind a host loading screen that's waiting on a
// click nobody can see to make.
Wavedash.init({ debug: import.meta.env.DEV });

async function bootstrap(): Promise<void> {
  // Load previously-persisted stats into the local cache before any getStat() call.
  await requestStatsOnBoot();

  const app = new Application();
  await app.init({
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    background: ROOM_BACKGROUND_COLOR,
    antialias: true,
  });

  const appRoot = document.querySelector<HTMLDivElement>('#app');
  if (!appRoot) throw new Error('#app root element not found');
  appRoot.innerHTML = '';
  appRoot.appendChild(app.canvas);

  // Left-side data screen — rows rendered over the screen.png bezel asset (400x760, see config).
  // Built once as real elements (not a <pre> of joined lines) so label/value alignment and
  // gaps are explicit CSS, and the AV TOWER value can be colored independently of its label.
  function buildDataScreenContent(container: HTMLDivElement) {
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'screen-header';
    header.textContent = 'SYSTEM STATUS';
    container.appendChild(header);

    const divider = document.createElement('div');
    divider.className = 'screen-divider';
    container.appendChild(divider);

    function addRow(label: string): HTMLSpanElement {
      const row = document.createElement('div');
      row.className = 'screen-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'screen-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('span');
      valueEl.className = 'screen-value';
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      container.appendChild(row);
      return valueEl;
    }

    const dataPoolValue = addRow('DATA POOL');

    // Reserves the row #dataPoolBar (an absolute-positioned sibling overlay) occupies.
    const barSpacer = document.createElement('div');
    barSpacer.className = 'row-spacer-bar';
    container.appendChild(barSpacer);

    const patchesValue = addRow('PATCHES');
    const uptimeValue = addRow('UPTIME');
    const infectedValue = addRow('INFECTED');
    const avTowerValue = addRow('AV TOWER');

    // Unlike DATA POOL/INFECTED (which reserve a row for a separately absolute-positioned
    // overlay), the stamina bar is a plain inline element inside its own row — no sprite
    // asset for it, and a 20px-tall row has plenty of room for a simple CSS fill bar.
    const staminaRow = document.createElement('div');
    staminaRow.className = 'screen-row';
    const staminaLabel = document.createElement('span');
    staminaLabel.className = 'screen-label';
    staminaLabel.textContent = 'STAMINA';
    const staminaTrack = document.createElement('div');
    staminaTrack.className = 'stamina-track';
    const staminaFill = document.createElement('div');
    staminaFill.className = 'stamina-fill';
    staminaTrack.appendChild(staminaFill);
    staminaRow.appendChild(staminaLabel);
    staminaRow.appendChild(staminaTrack);
    container.appendChild(staminaRow);

    // Reserves the row #infectedGrid (an absolute-positioned sibling overlay) occupies.
    const gridSpacer = document.createElement('div');
    gridSpacer.className = 'row-spacer-grid';
    container.appendChild(gridSpacer);

    return { dataPoolValue, patchesValue, uptimeValue, infectedValue, avTowerValue, staminaFill };
  }

  const dataScreenContentEl = document.querySelector<HTMLDivElement>('#dataScreenContent');
  if (!dataScreenContentEl) throw new Error('#dataScreenContent element not found');
  const dataScreenValues = buildDataScreenContent(dataScreenContentEl);

  const dataPoolBarEl = document.querySelector<HTMLDivElement>('#dataPoolBar');
  if (!dataPoolBarEl) throw new Error('#dataPoolBar element not found');
  const dataPoolBarSlots = buildDataPoolBar(dataPoolBarEl);

  const infectedGridEl = document.querySelector<HTMLDivElement>('#infectedGrid');
  if (!infectedGridEl) throw new Error('#infectedGrid element not found');
  const infectedGridCells = buildInfectedGrid(infectedGridEl);

  function updateDataScreen(state: GameState): void {
    const seconds = Math.floor(state.elapsedMs / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    const infectedCount = state.servers.filter((s) => s.state === 'INFECTED').length;
    const towerActive = state.antivirusTower !== null;
    const towerStatus = towerActive ? `ACTIVE ${Math.ceil(state.antivirusCooldownMs / 1000)}s` : 'READY';

    dataScreenValues.dataPoolValue.textContent = `${Math.ceil(state.dataPool)} / ${state.maxDataPool} TB`;
    dataScreenValues.patchesValue.textContent = String(state.totalPatches);
    dataScreenValues.uptimeValue.textContent = `${mm}:${ss}`;
    dataScreenValues.infectedValue.textContent = `${infectedCount} / ${state.servers.length}`;
    dataScreenValues.avTowerValue.textContent = towerStatus;
    dataScreenValues.avTowerValue.classList.toggle('status-active', towerActive);

    const staminaRatio = state.player.stamina / STAMINA_MAX;
    dataScreenValues.staminaFill.style.width = `${(staminaRatio * 100).toFixed(0)}%`;
    dataScreenValues.staminaFill.classList.toggle('stamina-low', staminaRatio <= 0.2);
  }

  // Internal render resolution stays fixed at ROOM_WIDTH x ROOM_HEIGHT (collision/layout math
  // depends on it). The bezel image and canvas are both fixed-pixel-size DOM elements, so
  // instead of resizing the canvas alone, #gameRoot (bezel + canvas, 1360x760) is scaled as
  // one unit via CSS transform to fit the viewport, preserving aspect ratio and their alignment.
  const gameRootEl = document.querySelector<HTMLDivElement>('#gameRoot');
  if (!gameRootEl) throw new Error('#gameRoot element not found');
  const gameRoot = gameRootEl;
  const ROOT_WIDTH = ROOM_WIDTH + SIDE_SCREEN_WIDTH;
  const ROOT_HEIGHT = ROOM_HEIGHT;
  function fitRootToViewport(): void {
    const scale = Math.min(window.innerWidth / ROOT_WIDTH, window.innerHeight / ROOT_HEIGHT);
    gameRoot.style.transform = `scale(${scale})`;
  }
  fitRootToViewport();
  window.addEventListener('resize', fitRootToViewport);

  // Geist Pixel Square is used throughout the HUD/dialogs/side screen — wait for it here
  // alongside the texture loads below so the loading screen covers every asset the game
  // depends on, not just Pixi textures.
  await document.fonts.ready;

  const floorTexture = await Assets.load('/assets/floor.png');
  floorTexture.source.scaleMode = 'nearest'; // keep 64x32 tile crisp when repeated, not blurred
  const wiresTexture = await Assets.load('/assets/wires.png');
  wiresTexture.source.scaleMode = 'nearest';
  // Must resolve before createGameState()/startRun() build any server/player visuals.
  await loadServerTextures();
  await loadAntivirusTextures();
  await loadPlayerTextures();
  await loadDialogTextures();

  const roomFloor = new Container();
  roomFloor.label = 'roomFloor';
  const floorTiling = new TilingSprite({ texture: floorTexture, width: ROOM_WIDTH, height: ROOM_HEIGHT });
  const floorBorder = new Graphics().rect(0, 0, ROOM_WIDTH, ROOM_HEIGHT).stroke({ width: 2, color: 0x2a2f3a });

  // Perimeter walls, WALL_THICKNESS thick on all four sides — carved out of the walkable floor
  // and enforced in collision.ts's clampToRoom, not just drawn here.
  const walls = new Graphics()
    .rect(0, 0, ROOM_WIDTH, WALL_THICKNESS)
    .rect(0, ROOM_HEIGHT - WALL_THICKNESS, ROOM_WIDTH, WALL_THICKNESS)
    .rect(0, 0, WALL_THICKNESS, ROOM_HEIGHT)
    .rect(ROOM_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, ROOM_HEIGHT)
    .fill(PLACEHOLDER_COLORS.wall);
  walls.label = 'walls';

  roomFloor.addChild(floorTiling, floorBorder, walls);

  // Full-room overlay (960x760, matches ROOM_WIDTH x ROOM_HEIGHT exactly) — sits above the
  // floor and below the server racks so wiring reads as running under/behind the servers.
  const wiresLayer = new Sprite(wiresTexture);
  wiresLayer.label = 'wiresLayer';

  const antivirusVisual = buildAntivirusVisual();

  const serverLayer = new Container();
  serverLayer.label = 'serverLayer';
  const playerLayer = new Container();
  playerLayer.label = 'playerLayer';

  const dialogBox = buildDialogBox(ROOM_WIDTH, ROOM_HEIGHT);
  const gameOverScreen = buildGameOverScreen(ROOM_WIDTH, ROOM_HEIGHT);

  app.stage.addChild(
    roomFloor,
    wiresLayer,
    antivirusVisual,
    serverLayer,
    playerLayer,
    dialogBox.container,
    gameOverScreen.container,
  );

  let state: GameState;
  let virusTickAccumulator = 0;
  let gameOverHandled = false;
  let prevPlayerState: GameState['player']['currentState'];
  let prevFacing: GameState['player']['facing'];
  let prevInteractableId: number | null = null;

  function startRun(): void {
    state = createGameState();
    virusTickAccumulator = 0;
    gameOverHandled = false;
    prevPlayerState = state.player.currentState;
    prevFacing = state.player.facing;
    prevInteractableId = null;

    serverLayer.removeChildren();
    for (const server of state.servers) {
      server.visual.x = server.worldX;
      server.visual.y = server.worldY;
      updateServerVisual(server, state.elapsedMs);

      // SECTION 4.7 — click-to-patch, same eligibility path as spacebar
      server.visual.eventMode = 'static';
      server.visual.cursor = 'pointer';
      server.visual.on('pointertap', () => attemptPatch(state, server.id));

      serverLayer.addChild(server.visual);
    }

    playerLayer.removeChildren();
    state.player.visual.x = state.player.x;
    state.player.visual.y = state.player.y;
    playerLayer.addChild(state.player.visual);

    gameOverScreen.setVisible(false);
    dialogBox.setEvent(null);

    bootSequence(state);
    triggerInitialOutbreak(state);
    recordGameStart();

    console.log(`[bootstrap] rendered ${state.servers.length} servers and 1 player, new run started`);
  }

  gameOverScreen.onRetry(() => startRun());
  gameOverScreen.onViewLeaderboard(() => {
    gameOverScreen.showLeaderboardLoading();
    fetchLeaderboardEntries().then((result) => {
      if (result.success) {
        gameOverScreen.showLeaderboardRows(result.rows);
      } else {
        gameOverScreen.showLeaderboardError(result.message);
      }
    });
  });

  initInput();

  // Every dialog (tutorial, mid-game warning, data alerts) blocks and only dismisses on
  // Enter — no click, no other key — so the player can't accidentally skip past one while
  // input is meant to be locked out.
  window.addEventListener('keydown', (e) => {
    if (!state.dialog.activeEvent || !state.dialog.isBlockingInput) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') dismissActiveDialog(state);
  });

  startRun();
  startBackgroundMusic();

  app.ticker.add((ticker) => {
    const deltaMs = ticker.deltaMS;

    pumpDialogQueue(state);
    dialogBox.setEvent(state.dialog.activeEvent);

    // Every dialog now blocks (Section 3.1/3.2 deviation — see dialog.ts): no elapsed-time
    // advance, no virus tick accumulation, no movement/patching while one is on screen.
    // Everything below this point is simulation, not rendering, so it's the one thing
    // allowed to stop dead.
    if (!state.dialog.isBlockingInput) {
      state.elapsedMs += deltaMs;

      if (!state.gameOver) {
        virusTickAccumulator += deltaMs;
        while (virusTickAccumulator >= VIRUS_TICK_MS) {
          virusTickAccumulator -= VIRUS_TICK_MS;
          virusTick(state);
        }

        updatePlayerMovement(state.player, getMovementAxis(), deltaMs / 1000, isSprintHeld());
        resolveServerCollisions(state.player, state.servers);
        clampToRoom(state.player);

        const interactable = findInteractableServer(state.player, state.servers);
        if (consumeInteractPress() && interactable) {
          attemptPatch(state, interactable.id);
        }

        updatePatching(state, deltaMs);
        updateImmunityTimers(state, deltaMs);

        updateAntivirusTower(state, deltaMs);
        if (consumeAntivirusPress()) {
          attemptPlaceAntivirusTower(state, state.player);
        }

        const interactableId = interactable ? interactable.id : null;
        if (interactableId !== prevInteractableId) {
          console.log(`[interact] nearest server in range: ${interactableId ?? 'none'}`);
          prevInteractableId = interactableId;
        }

        checkDialogTriggers(state);
        checkTimeBasedAchievements(state);
      }
    }

    state.player.visual.x = state.player.x;
    state.player.visual.y = state.player.y;
    updatePlayerVisual(state.player);

    for (const server of state.servers) {
      updateServerVisual(server, state.elapsedMs);
    }

    updateAntivirusVisual(antivirusVisual, state);

    updateDataScreen(state);
    updateDataPoolBar(dataPoolBarSlots, state);
    updateInfectedGrid(infectedGridCells, state);

    if (state.player.currentState !== prevPlayerState || state.player.facing !== prevFacing) {
      console.log(`[player] state=${state.player.currentState} facing=${state.player.facing} @ ${state.elapsedMs.toFixed(0)}ms`);
      prevPlayerState = state.player.currentState;
      prevFacing = state.player.facing;
    }

    if (state.gameOver && !gameOverHandled) {
      gameOverHandled = true;
      gameOverScreen.setStats(state.totalPatches, state.elapsedMs);
      gameOverScreen.setVisible(true);
      onGameOver(state);
      recordGameOverStats(state);
    }
  });
}

// Home screen shows instantly (plain DOM, no asset loading involved) — bootstrap() itself,
// with every texture/font/Wavedash load it awaits, only runs once the player opts in by
// pressing Start, and the loading screen covers exactly that window.
const homeScreenEl = document.querySelector<HTMLDivElement>('#homeScreen');
const loadingScreenEl = document.querySelector<HTMLDivElement>('#loadingScreen');
const loadingTextEl = document.querySelector<HTMLDivElement>('#loadingText');
const startButtonEl = document.querySelector<HTMLButtonElement>('#startButton');
if (!homeScreenEl || !loadingScreenEl || !loadingTextEl || !startButtonEl) {
  throw new Error('Home/loading screen elements not found');
}

startButtonEl.addEventListener('click', () => {
  homeScreenEl.style.display = 'none';
  loadingScreenEl.style.display = 'flex';

  bootstrap()
    .then(() => {
      loadingScreenEl.style.display = 'none';
    })
    .catch((err) => {
      console.error('[bootstrap] failed to start game', err);
      loadingTextEl.textContent = 'FAILED TO LOAD — please refresh.';
    });
});
