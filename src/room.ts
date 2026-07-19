import {
  GRID_COLS,
  GRID_ROWS,
  RACK_COUNT,
  ROOM_CELL_SIZE,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  SERVER_FOOTPRINT,
  SERVER_JITTER,
} from './config';
import type { RoomLayout } from './types';

// Centers the cols x rows server grid within the room, leaving equal margins
// on all sides for walkable clearance around the outer ring of servers.
export function createRoomLayout(): RoomLayout {
  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  const cellSize = ROOM_CELL_SIZE;

  const occupiedWidth = (cols - 1) * cellSize + SERVER_FOOTPRINT;
  const occupiedHeight = (rows - 1) * cellSize + SERVER_FOOTPRINT;

  return {
    cols,
    rows,
    originX: (ROOM_WIDTH - occupiedWidth) / 2 + SERVER_FOOTPRINT / 2,
    originY: (ROOM_HEIGHT - occupiedHeight) / 2 + SERVER_FOOTPRINT / 2,
    cellSize,
  };
}

// SECTION 1.6 — worldX/worldY are computed once at layout time, not re-derived every frame.
// Each slot gets a random +/- SERVER_JITTER offset so the racks read as a jittered grid rather
// than a rigid one; magnitude is capped (see config.ts) to guarantee inter-rack corridors never
// seal shut.
export function layoutServers(layout: RoomLayout): { worldX: number; worldY: number }[] {
  const positions = [];
  for (let i = 0; i < RACK_COUNT; i++) {
    const gx = i % layout.cols;
    const gy = Math.floor(i / layout.cols);
    const jitterX = (Math.random() * 2 - 1) * SERVER_JITTER;
    const jitterY = (Math.random() * 2 - 1) * SERVER_JITTER;
    positions.push({
      worldX: layout.originX + gx * layout.cellSize + jitterX,
      worldY: layout.originY + gy * layout.cellSize + jitterY,
    });
  }
  return positions;
}
