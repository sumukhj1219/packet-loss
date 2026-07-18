import { GRID_COLS, GRID_ROWS } from './config';
import { recordDuplicationSurvivedStat } from './stats';
import type { GameState } from './types';
import { ACHIEVEMENTS, grantAchievement } from './wavedashIntegration';

// SECTION 2.1 — Boundary-checked neighbor resolution (precomputed once at grid init)
export function computeNeighborIds(id: number): number[] {
  const x = id % GRID_COLS;
  const y = Math.floor(id / GRID_COLS);
  const neighbors: number[] = [];

  const candidates = [
    { dx: 0, dy: -1 }, // UP
    { dx: 0, dy: 1 }, // DOWN
    { dx: -1, dy: 0 }, // LEFT
    { dx: 1, dy: 0 }, // RIGHT
  ];

  for (const { dx, dy } of candidates) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
      neighbors.push(ny * GRID_COLS + nx);
    }
  }
  return neighbors;
}

function spawnRandomInfection(state: GameState) {
  const eligible = state.servers.filter((s) => s.state === 'IDLE');
  if (eligible.length === 0) return null;

  const target = eligible[Math.floor(Math.random() * eligible.length)];
  target.state = 'INFECTED';
  target.infectedAtMs = state.elapsedMs;
  return target;
}

// SECTION 2.2 — Outbreak initiation
export function triggerInitialOutbreak(state: GameState): void {
  const target = spawnRandomInfection(state);
  if (target) console.log(`[virus] initial outbreak @ server ${target.id}`);
}

export const VIRUS_TICK_MS = 2000;
// Lowered from 0.35 — at 0.35 an interior 4-neighbor rack had ~82% odds of spreading
// at least once per 2s tick, snowballing the infected count (and drain) too fast once
// duplication or re-outbreak added a second active source.
export const SPREAD_CHANCE_PER_NEIGHBOR = 0.18;

// SECTION 2.3 — Spread tick (called every VIRUS_TICK_MS while !virusPaused)
export function virusTick(state: GameState): void {
  if (state.virusPaused || state.gameOver) return;

  const infected = state.servers.filter((s) => s.state === 'INFECTED');

  for (const source of infected) {
    state.dataPool = Math.max(0, state.dataPool - source.dataDrainPerSecond * (VIRUS_TICK_MS / 1000));

    for (const nId of source.neighborIds) {
      const neighbor = state.servers[nId];

      // Jump-eligibility filter: excludes IMMUNE, LOCKED, and already-INFECTED targets
      if (neighbor.state !== 'IDLE') continue;

      if (Math.random() < SPREAD_CHANCE_PER_NEIGHBOR) {
        neighbor.state = 'INFECTED';
        neighbor.infectedAtMs = state.elapsedMs;
        console.log(`[virus] spread ${source.id} -> ${neighbor.id} @ ${state.elapsedMs.toFixed(0)}ms`);
      }
    }
  }

  if (infected.length > 0) {
    console.log(`[virus] tick: dataPool=${state.dataPool.toFixed(0)} infected=[${infected.map((s) => s.id).join(',')}]`);
  }

  if (state.dataPool <= 0) {
    state.gameOver = true;
    console.log(`[virus] GAME OVER @ ${state.elapsedMs.toFixed(0)}ms — dataPool depleted`);
    return;
  }

  // Keep a live threat between duplication milestones: curing the last active
  // infection would otherwise leave the virus fully dormant until the next
  // multiple-of-10 patch, which contradicts "spreads over time" (Section 0).
  if (infected.length === 0) {
    const target = spawnRandomInfection(state);
    if (target) console.log(`[virus] re-outbreak @ server ${target.id} (no active infections) @ ${state.elapsedMs.toFixed(0)}ms`);
  }
}

export const DUPLICATION_SPAWN_COUNT = 2;

// SECTION 2.5 — duplication on multiples of 10, guarded against double-fire
export function checkDuplicationThreshold(state: GameState): void {
  const isNewMultipleOf10 = state.totalPatches % 10 === 0 && state.totalPatches !== state.lastDuplicationMultiple;

  if (!isNewMultipleOf10) return;

  state.lastDuplicationMultiple = state.totalPatches;

  const eligible = state.servers.filter((s) => s.state === 'IDLE');

  // Not in the PRD's original scaling formula — flat +2 per duplication event,
  // capped by however many IDLE racks remain (never crash on an empty pool).
  const spawnCount = Math.min(DUPLICATION_SPAWN_COUNT, eligible.length);

  const spawned: number[] = [];
  for (let i = 0; i < spawnCount; i++) {
    const idx = Math.floor(Math.random() * eligible.length);
    const target = eligible.splice(idx, 1)[0];
    target.state = 'INFECTED';
    target.infectedAtMs = state.elapsedMs;
    spawned.push(target.id);
  }

  console.log(`[virus] duplication @ totalPatches=${state.totalPatches} -> spawned [${spawned.join(',')}]`);

  if (spawned.length > 0 && !state.gameOver) {
    grantAchievement(ACHIEVEMENTS.SURVIVED_OUTBREAK_DUPLICATION);
    recordDuplicationSurvivedStat();
  }
}
