import { ROOM_HEIGHT, ROOM_WIDTH, WALL_THICKNESS } from './config';
import { createPlayer, createServers } from './entities';
import { createRoomLayout } from './room';
import type { GameState } from './types';

// SECTION 1.5 — Global GameState factory
export function createGameState(): GameState {
  const layout = createRoomLayout();

  return {
    dataPool: 10000,
    maxDataPool: 10000,
    totalPatches: 0,
    lastDuplicationMultiple: 0,
    servers: createServers(layout),
    // -32 boundingRadius matches createPlayer's fixed value; clampToRoom would otherwise
    // yank the player up on the very first tick since this spot now sits inside the wall.
    player: createPlayer(ROOM_WIDTH / 2, ROOM_HEIGHT - WALL_THICKNESS - 32),
    dialog: {
      queue: [],
      activeEvent: null,
      triggeredEventIds: new Set(),
      isBlockingInput: false,
    },
    // Not paused from boot — the initial outbreak drains/spreads immediately,
    // no tutorial grace period until the first patch (see Section 3.2 deviation).
    virusPaused: false,
    gameOver: false,
    elapsedMs: 0,
    antivirusTower: null,
    antivirusCooldownMs: 0,
  };
}
