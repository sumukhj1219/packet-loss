import { RACK_COUNT } from '../config';
import type { GameState } from '../types';

// Side-screen infected-server grid — plain DOM <div> cells mirroring the main game screen's
// 5x4 rack layout, not Pixi, since the side screen (index.html #dataScreen) is an HTML
// overlay, not the game canvas. Caller drives updateInfectedGrid() from the same loop as
// updateDataScreen/updateDataPoolBar. Cell order matches server.id (row-major over
// GRID_COLS x GRID_ROWS, see entities.ts createServers), so it reads left-to-right,
// top-to-bottom exactly like the room grid.
export function buildInfectedGrid(container: HTMLDivElement): HTMLDivElement[] {
  container.innerHTML = '';
  const cells: HTMLDivElement[] = [];

  for (let i = 0; i < RACK_COUNT; i++) {
    const cell = document.createElement('div');
    cell.className = 'infected-cell';
    container.appendChild(cell);
    cells.push(cell);
  }

  return cells;
}

export function updateInfectedGrid(cells: HTMLDivElement[], state: GameState): void {
  for (let i = 0; i < cells.length; i++) {
    const infected = state.servers[i]?.state === 'INFECTED';
    cells[i].classList.toggle('infected', infected);
  }
}
