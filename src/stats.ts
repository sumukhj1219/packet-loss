import Wavedash from '@wvdsh/sdk-js';
import type { GameState } from './types';
import { ACHIEVEMENTS, grantAchievement } from './wavedashIntegration';

// SECTION 5.3 (stats) — every identifier here must have a matching entry
// (ID, display name) created in the Wavedash Developer Portal, same as achievements.
export const STATS = {
  GAMES_PLAYED: 'games_played', // lifetime run count
  TOTAL_PATCHES_LIFETIME: 'total_patches_lifetime', // cumulative patches across all runs
  BEST_PATCHES_SURVIVED: 'best_patches_survived', // personal best single-run patch count
  TOTAL_DUPLICATIONS_SURVIVED: 'total_duplications_survived', // lifetime 10x-duplication count
} as const;

const MARATHON_THRESHOLD_MS = 180_000; // 3 minutes
const VETERAN_THRESHOLD_PATCHES = 50;
const DEDICATED_THRESHOLD_GAMES = 10;

let marathonGrantedThisRun = false;

// Call once at boot, after Wavedash.init(), and before any getStat/setStat — otherwise
// the local stats cache starts at 0 instead of reflecting previously persisted values.
export async function requestStatsOnBoot(): Promise<void> {
  try {
    const result = await Wavedash.requestStats();
    if (!result.success) console.error('[Wavedash] requestStats failed', result.message);
  } catch (err) {
    console.error('[Wavedash] requestStats threw', err);
  }
}

// Call once per run, right as a fresh outbreak starts.
export function recordGameStart(): void {
  marathonGrantedThisRun = false;

  const gamesPlayed = Wavedash.getStat(STATS.GAMES_PLAYED) + 1;
  Wavedash.setStat(STATS.GAMES_PLAYED, gamesPlayed, true);

  if (gamesPlayed === DEDICATED_THRESHOLD_GAMES) {
    grantAchievement(ACHIEVEMENTS.DEDICATED);
  }
}

// Call from patch.ts on every successful patch completion.
export function recordPatchStat(state: GameState): void {
  const lifetimePatches = Wavedash.getStat(STATS.TOTAL_PATCHES_LIFETIME) + 1;
  Wavedash.setStat(STATS.TOTAL_PATCHES_LIFETIME, lifetimePatches); // batched, flushed at game over

  if (state.totalPatches === VETERAN_THRESHOLD_PATCHES) {
    grantAchievement(ACHIEVEMENTS.VETERAN);
  }
}

// Call from virus.ts whenever a duplication event actually spawns new infections.
export function recordDuplicationSurvivedStat(): void {
  const total = Wavedash.getStat(STATS.TOTAL_DUPLICATIONS_SURVIVED) + 1;
  Wavedash.setStat(STATS.TOTAL_DUPLICATIONS_SURVIVED, total, true);
}

// Tick-driven check — call every frame from the game loop, same pattern as
// checkDialogTriggers (Section 3.1), since this can't hang off a discrete event.
export function checkTimeBasedAchievements(state: GameState): void {
  if (marathonGrantedThisRun) return;
  if (state.elapsedMs < MARATHON_THRESHOLD_MS) return;

  marathonGrantedThisRun = true;
  grantAchievement(ACHIEVEMENTS.MARATHON);
}

// Call once at game over: update the personal-best stat and flush every batched
// (storeNow: false) stat update from this run in a single network request.
export function recordGameOverStats(state: GameState): void {
  const best = Wavedash.getStat(STATS.BEST_PATCHES_SURVIVED);
  if (state.totalPatches > best) {
    Wavedash.setStat(STATS.BEST_PATCHES_SURVIVED, state.totalPatches);
  }
  Wavedash.storeStats();
}
