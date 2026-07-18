import { Application, Container, Graphics } from 'pixi.js';
import { ROOM_BACKGROUND_COLOR, ROOM_HEIGHT, ROOM_WIDTH } from './config';
import { clampToRoom, resolveServerCollisions } from './collision';
import { bootSequence, checkDialogTriggers, dismissActiveDialog, pumpDialogQueue } from './dialog';
import { consumeInteractPress, getMovementAxis, initInput } from './input';
import { attemptPatch, findInteractableServer } from './interaction';
import { updateImmunityTimers, updatePatching } from './patch';
import { updatePlayerMovement } from './player';
import { checkTimeBasedAchievements, recordGameOverStats, recordGameStart, requestStatsOnBoot } from './stats';
import { createGameState } from './state';
import type { GameState } from './types';
import { buildAchievementToast } from './visuals/achievementToast';
import { buildDialogBox } from './visuals/dialogBox';
import { buildGameOverScreen } from './visuals/gameOverScreen';
import { buildDataPoolHud, updateDataPoolHud } from './visuals/hud';
import { updatePlayerVisual } from './visuals/playerVisual';
import { updateServerVisual } from './visuals/serverVisual';
import { triggerInitialOutbreak, VIRUS_TICK_MS, virusTick } from './virus';
import Wavedash from '@wvdsh/sdk-js';
import { ACHIEVEMENT_LABELS, consumeAchievementNotifications, fetchLeaderboardEntries, onGameOver } from './wavedashIntegration';
import './style.css';

async function bootstrap(): Promise<void> {
  // SECTION 5.1 — synchronous, not a promise: the game stays hidden behind the
  // Wavedash loading screen until this fires, so call it once we're ready to play.
  Wavedash.init({ debug: import.meta.env.DEV });
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
  const achievementToast = buildAchievementToast(ROOM_WIDTH);

  app.stage.addChild(
    roomFloor,
    serverLayer,
    playerLayer,
    hudLayer,
    dialogBox.container,
    gameOverScreen.container,
    achievementToast.container,
  );

  let state: GameState;
  let virusTickAccumulator = 0;
  let gameOverHandled = false;
  let prevPlayerState: GameState['player']['currentState'];
  let prevFacing: GameState['player']['facing'];
  let prevInteractableId: number | null = null;
  let toastQueue: string[] = [];
  let toastActive = false;

  function startRun(): void {
    state = createGameState();
    virusTickAccumulator = 0;
    gameOverHandled = false;
    prevPlayerState = state.player.currentState;
    prevFacing = state.player.facing;
    prevInteractableId = null;
    toastQueue = [];
    toastActive = false;

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

    updateDataPoolHud(dataPoolHud, state);

    if (state.player.currentState !== prevPlayerState || state.player.facing !== prevFacing) {
      console.log(`[player] state=${state.player.currentState} facing=${state.player.facing} @ ${state.elapsedMs.toFixed(0)}ms`);
      prevPlayerState = state.player.currentState;
      prevFacing = state.player.facing;
    }

    for (const id of consumeAchievementNotifications()) {
      toastQueue.push(ACHIEVEMENT_LABELS[id] ?? id);
    }
    if (!toastActive && toastQueue.length > 0) {
      achievementToast.show(toastQueue.shift()!);
      toastActive = true;
    } else if (toastActive) {
      toastActive = achievementToast.update(deltaMs);
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

bootstrap().catch((err) => {
  console.error('[bootstrap] failed to start game', err);
});
