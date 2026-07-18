import { Application, Container, Graphics } from 'pixi.js';
import { ROOM_BACKGROUND_COLOR, ROOM_HEIGHT, ROOM_WIDTH } from './config';
import { clampToRoom, resolveServerCollisions } from './collision';
import { bootSequence, checkDialogTriggers, dismissActiveDialog, pumpDialogQueue } from './dialog';
import { consumeInteractPress, getMovementAxis, initInput } from './input';
import { attemptPatch, findInteractableServer } from './interaction';
import { updateImmunityTimers, updatePatching } from './patch';
import { updatePlayerMovement } from './player';
import { createGameState } from './state';
import type { GameState } from './types';
import { buildDialogBox } from './visuals/dialogBox';
import { buildGameOverScreen } from './visuals/gameOverScreen';
import { buildDataPoolHud, updateDataPoolHud } from './visuals/hud';
import { updatePlayerVisual } from './visuals/playerVisual';
import { updateServerVisual } from './visuals/serverVisual';
import { triggerInitialOutbreak, VIRUS_TICK_MS, virusTick } from './virus';
import Wavedash from '@wvdsh/sdk-js';
import { fetchLeaderboardEntries, onGameOver } from './wavedashIntegration';
import './style.css';

// Non-blocking alerts auto-dismiss after this long if the player doesn't click/keypress first.
const AUTO_DISMISS_ALERT_MS = 4000;

async function bootstrap(): Promise<void> {
  // SECTION 5.1 — synchronous, not a promise: the game stays hidden behind the
  // Wavedash loading screen until this fires, so call it once we're ready to play.
  Wavedash.init({ debug: import.meta.env.DEV });

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

  const roomFloor = new Container();
  roomFloor.label = 'roomFloor';
  const floorGraphic = new Graphics()
    .rect(0, 0, ROOM_WIDTH, ROOM_HEIGHT)
    .fill(ROOM_BACKGROUND_COLOR)
    .stroke({ width: 2, color: 0x2a2f3a });
  roomFloor.addChild(floorGraphic);

  const serverLayer = new Container();
  serverLayer.label = 'serverLayer';
  const playerLayer = new Container();
  playerLayer.label = 'playerLayer';

  const hudLayer = new Container();
  hudLayer.label = 'hudLayer';
  const dataPoolHud = buildDataPoolHud();
  hudLayer.addChild(dataPoolHud);

  const dialogBox = buildDialogBox(ROOM_WIDTH, ROOM_HEIGHT);
  const gameOverScreen = buildGameOverScreen(ROOM_WIDTH, ROOM_HEIGHT);

  app.stage.addChild(roomFloor, serverLayer, playerLayer, hudLayer, dialogBox.container, gameOverScreen.container);

  let state: GameState;
  let dialogElapsedMs = 0;
  let virusTickAccumulator = 0;
  let gameOverHandled = false;
  let prevPlayerState: GameState['player']['currentState'];
  let prevFacing: GameState['player']['facing'];
  let prevInteractableId: number | null = null;

  function startRun(): void {
    state = createGameState();
    dialogElapsedMs = 0;
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

  const dismissIfDialogActive = () => {
    if (state.dialog.activeEvent) dismissActiveDialog(state);
  };
  window.addEventListener('keydown', dismissIfDialogActive);
  app.canvas.addEventListener('pointerdown', dismissIfDialogActive);

  startRun();

  app.ticker.add((ticker) => {
    const deltaMs = ticker.deltaMS;
    state.elapsedMs += deltaMs;

    pumpDialogQueue(state);
    dialogBox.setEvent(state.dialog.activeEvent);

    if (state.dialog.activeEvent && !state.dialog.activeEvent.pausesSimulation) {
      dialogElapsedMs += deltaMs;
      if (dialogElapsedMs >= AUTO_DISMISS_ALERT_MS) {
        dismissActiveDialog(state);
        dialogElapsedMs = 0;
      }
    } else {
      dialogElapsedMs = 0;
    }

    if (!state.gameOver) {
      virusTickAccumulator += deltaMs;
      while (virusTickAccumulator >= VIRUS_TICK_MS) {
        virusTickAccumulator -= VIRUS_TICK_MS;
        virusTick(state);
      }

      if (!state.dialog.isBlockingInput) {
        updatePlayerMovement(state.player, getMovementAxis(), deltaMs / 1000);
        resolveServerCollisions(state.player, state.servers);
        clampToRoom(state.player);

        const interactable = findInteractableServer(state.player, state.servers);
        if (consumeInteractPress() && interactable) {
          attemptPatch(state, interactable.id);
        }

        updatePatching(state, deltaMs);
        updateImmunityTimers(state, deltaMs);

        const interactableId = interactable ? interactable.id : null;
        if (interactableId !== prevInteractableId) {
          console.log(`[interact] nearest server in range: ${interactableId ?? 'none'}`);
          prevInteractableId = interactableId;
        }
      }

      checkDialogTriggers(state);
    }

    state.player.visual.x = state.player.x;
    state.player.visual.y = state.player.y;
    updatePlayerVisual(state.player);

    for (const server of state.servers) {
      updateServerVisual(server, state.elapsedMs);
    }

    updateDataPoolHud(dataPoolHud, state);

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
    }
  });
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed to start game', err);
});
