import Wavedash from '@wvdsh/sdk-js';
import type { GameState } from './types';

// SECTION 5.3 — Achievements
export const ACHIEVEMENTS = {
  FIRST_PATCH: 'first_patch',
  SURVIVED_OUTBREAK_DUPLICATION: 'outbreak_survivor', // lived through a 10x duplication event
  DATA_GUARDIAN: 'data_guardian', // game ended with dataPool > 50%
  RAPID_RESPONSE: 'rapid_response', // patched a rack within 2s of it going INFECTED
} as const;

// Wavedash's setAchievement is synchronous and local-only (no promise) — storeNow
// forces an immediate backend write instead of the default throttled persist, since
// the PRD wants these to survive a crash mid-run, not just a graceful game over.
export function grantAchievement(id: string): void {
  try {
    Wavedash.setAchievement(id, true);
  } catch (err) {
    console.error(`[Wavedash] failed to set achievement ${id}`, err);
  }
}

const LEADERBOARD_NAME = 'patches-survived';
const LEADERBOARD_FETCH_LIMIT = 10;

export interface LeaderboardRow {
  rank: number;
  username: string;
  score: number;
}

export type FetchLeaderboardResult = { success: true; rows: LeaderboardRow[] } | { success: false; message: string };

export async function fetchLeaderboardEntries(): Promise<FetchLeaderboardResult> {
  try {
    const leaderboard = await Wavedash.getOrCreateLeaderboard(
      LEADERBOARD_NAME,
      Wavedash.LeaderboardSortOrder.DESC,
      Wavedash.LeaderboardDisplayType.NUMERIC,
    );
    if (!leaderboard.success) return { success: false, message: leaderboard.message };

    const entries = await Wavedash.listLeaderboardEntries(leaderboard.data.id, 0, LEADERBOARD_FETCH_LIMIT);
    if (!entries.success) return { success: false, message: entries.message };

    const rows = entries.data.map((entry) => ({ rank: entry.globalRank, username: entry.username, score: entry.score }));
    return { success: true, rows };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// SECTION 5.2 — Leaderboard submission on game over
export async function onGameOver(state: GameState): Promise<void> {
  const score = state.totalPatches; // primary score metric; elapsedMs as tiebreaker/secondary stat

  // Only reachable if a future "win"/timed-session ending is added — the current sole
  // game-over condition (dataPool depleted to 0) can never satisfy dataPool > 50%.
  if (state.dataPool / state.maxDataPool > 0.5) {
    grantAchievement(ACHIEVEMENTS.DATA_GUARDIAN);
  }

  try {
    const leaderboard = await Wavedash.getOrCreateLeaderboard(
      LEADERBOARD_NAME,
      Wavedash.LeaderboardSortOrder.DESC, // higher totalPatches ranks first
      Wavedash.LeaderboardDisplayType.NUMERIC,
    );
    if (!leaderboard.success) throw new Error(leaderboard.message);

    // Diagnostic: if this `id` differs between runs, or `totalEntries` never climbs
    // past 0 despite successful submits below, we're resolving to (or the dashboard
    // is showing) a different leaderboard object than the one entries land in.
    console.log(
      `[Wavedash] leaderboard resolved: id=${leaderboard.data.id} totalEntries(before this submit)=${leaderboard.data.totalEntries}`,
    );

    // keepBest=true: never overwrite a player's higher-ranked prior run with a worse one
    const upload = await Wavedash.uploadLeaderboardScore(leaderboard.data.id, score, true);
    if (!upload.success) throw new Error(upload.message);

    console.log(`[Wavedash] leaderboard score submitted: ${score} (rank ${upload.data.globalRank}, leaderboardId=${leaderboard.data.id})`);
  } catch (err) {
    console.error('[Wavedash] leaderboard upload failed', err);
    // fail gracefully — never block the game-over screen on network issues
  }
}
