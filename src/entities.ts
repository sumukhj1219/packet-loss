import { GRID_COLS } from './config';
import { layoutServers } from './room';
import { buildPlayerVisual } from './visuals/playerVisual';
import { buildImmunityRingVisual, buildServerVisual } from './visuals/serverVisual';
import type { PlayerComponent, RoomLayout, ServerComponent } from './types';
import { computeNeighborIds } from './virus';

export function createServers(layout: RoomLayout): ServerComponent[] {
  const positions = layoutServers(layout);

  return positions.map((pos, id) => {
    const visual = buildServerVisual();
    const overlayVisual = buildImmunityRingVisual();
    visual.addChild(overlayVisual);

    return {
      id,
      gridX: id % GRID_COLS,
      gridY: Math.floor(id / GRID_COLS),
      state: 'IDLE',
      worldX: pos.worldX,
      worldY: pos.worldY,
      dataDrainPerSecond: 22, // lowered from 40 — multiple simultaneous infections were draining the pool too fast
      immunityRemainingMs: 0,
      infectedAtMs: null,
      visual,
      overlayVisual,
      neighborIds: computeNeighborIds(id),
    };
  });
}

export function createPlayer(startX: number, startY: number): PlayerComponent {
  return {
    x: startX,
    y: startY,
    velocityX: 0,
    velocityY: 0,
    speed: 180,
    currentState: 'IDLE',
    facing: 'DOWN',
    facingLocked: false,
    patchTimer: 0,
    targetServerId: null,
    visual: buildPlayerVisual(),
    boundingRadius: 16,
  };
}
