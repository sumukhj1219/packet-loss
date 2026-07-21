import Wavedash from '@wvdsh/sdk-js';
import type { GameState } from './types';

// SECTION 5.3 — Achievements. Every identifier here must have a matching entry
// (ID, title, description) created in the Wavedash Developer Portal — the SDK
// can't register achievement metadata from code.
export const ACHIEVEMENTS = {
  FIRST_PATCH: 'first_patch',
  SURVIVED_OUTBREAK_DUPLICATION: 'outbreak_survivor', // lived through a 10x duplication event
  DATA_GUARDIAN: 'data_guardian', // game ended with dataPool > 50%
  RAPID_RESPONSE: 'rapid_response', // patched a rack within 2s of it going INFECTED
  VETERAN: 'veteran', // 50 patches completed within a single run
  MARATHON: 'marathon', // survived 3 minutes of elapsed time in a single run
  DEDICATED: 'dedicated', // played 10 games, lifetime
  CENTURY_CLUB: 'century_club', // 100 total patches, lifetime
  OVERACHIEVER: 'overachiever', // 100 patches completed within a single run
  SPEED_DEMON: 'speed_demon', // 5 consecutive rapid-response patches in a row, single run
  LIGHTNING_REFLEXES: 'lightning_reflexes', // patched a rack within 500ms of it going INFECTED
  UNTOUCHABLE: 'untouchable', // game ended with dataPool >= 90%
  CLUTCH_SAVE: 'clutch_save', // patched an infected rack while dataPool was below 10%
  NO_ANTIVIRUS_NEEDED: 'no_antivirus_needed', // 30 patches in a single run without ever placing an AV tower
  FIRST_LINE_OF_DEFENSE: 'first_line_of_defense', // placed an AV tower for the first time, lifetime
  AREA_DENIAL: 'area_denial', // a single AV tower placement instantly cured 3+ infected racks
  TOWER_MASTER: 'tower_master', // 10 AV towers placed, lifetime
  OUTBREAK_VETERAN: 'outbreak_veteran', // survived 5 duplication events, lifetime
  CHAOS_CONTAINED: 'chaos_contained', // 8+ racks infected simultaneously and survived the tick
  LONG_HAUL: 'long_haul', // survived 5 minutes of elapsed time in a single run
  IRON_WILL: 'iron_will', // survived 10 minutes of elapsed time in a single run
  COMMITTED: 'committed', // played 25 games, lifetime
} as const;

// Display names for the top-center "achievement unlocked" toast — must match
// wavedash-import.json's display_name fields so the in-game label and the
// Developer Portal agree.
export const ACHIEVEMENT_LABELS: Record<string, string> = {
  [ACHIEVEMENTS.FIRST_PATCH]: 'First Patch',
  [ACHIEVEMENTS.SURVIVED_OUTBREAK_DUPLICATION]: 'Outbreak Survivor',
  [ACHIEVEMENTS.DATA_GUARDIAN]: 'Data Guardian',
  [ACHIEVEMENTS.RAPID_RESPONSE]: 'Rapid Response',
  [ACHIEVEMENTS.VETERAN]: 'Veteran',
  [ACHIEVEMENTS.MARATHON]: 'Marathon',
  [ACHIEVEMENTS.DEDICATED]: 'Dedicated',
  [ACHIEVEMENTS.CENTURY_CLUB]: 'Century Club',
  [ACHIEVEMENTS.OVERACHIEVER]: 'Overachiever',
  [ACHIEVEMENTS.SPEED_DEMON]: 'Speed Demon',
  [ACHIEVEMENTS.LIGHTNING_REFLEXES]: 'Lightning Reflexes',
  [ACHIEVEMENTS.UNTOUCHABLE]: 'Untouchable',
  [ACHIEVEMENTS.CLUTCH_SAVE]: 'Clutch Save',
  [ACHIEVEMENTS.NO_ANTIVIRUS_NEEDED]: 'No Antivirus Needed',
  [ACHIEVEMENTS.FIRST_LINE_OF_DEFENSE]: 'First Line of Defense',
  [ACHIEVEMENTS.AREA_DENIAL]: 'Area Denial',
  [ACHIEVEMENTS.TOWER_MASTER]: 'Tower Master',
  [ACHIEVEMENTS.OUTBREAK_VETERAN]: 'Outbreak Veteran',
  [ACHIEVEMENTS.CHAOS_CONTAINED]: 'Chaos Contained',
  [ACHIEVEMENTS.LONG_HAUL]: 'Long Haul',
  [ACHIEVEMENTS.IRON_WILL]: 'Iron Will',
  [ACHIEVEMENTS.COMMITTED]: 'Committed',
};

// Not in the PRD — a lightweight notification queue so the UI layer can show a toast
// the moment an achievement unlocks, without grantAchievement (called deep in game
// logic — patch.ts, virus.ts) needing to know anything about rendering.
const pendingNotifications: string[] = [];

// Wavedash's setAchievement is synchronous and local-only (no promise) — storeNow
// forces an immediate backend write instead of the default throttled persist, since
// the PRD wants these to survive a crash mid-run, not just a graceful game over.
//
// Achievements only ever unlock once — grantAchievement can legitimately be called
// repeatedly for the same id (e.g. SURVIVED_OUTBREAK_DUPLICATION fires on every 10-patch
// milestone). Originally this guarded solely on Wavedash.getAchievement(id), but that
// SDK call isn't actually ready the instant Wavedash.init() returns — it depends on a
// background subscription that resolves shortly after boot. A milestone firing before
// that subscription resolves saw getAchievement()/setAchievement() both silently no-op
// (SDK-internal "not ready" guard), so the *next* milestone re-read false and pushed a
// second toast for the same achievement. Track "already notified" locally so a single
// page session never re-announces an id, regardless of SDK readiness.
const grantedThisSession = new Set<string>();

export function grantAchievement(id: string): void {
  if (grantedThisSession.has(id)) return;

  try {
    if (Wavedash.getAchievement(id)) {
      grantedThisSession.add(id);
      return;
    }
  } catch (err) {
    console.error(`[Wavedash] failed to read achievement ${id}, attempting grant anyway`, err);
  }

  grantedThisSession.add(id);
  pendingNotifications.push(id);
  try {
    Wavedash.setAchievement(id, true);
  } catch (err) {
    console.error(`[Wavedash] failed to set achievement ${id}`, err);
  }
}

// Call once per frame from the UI layer; drains and returns any achievements
// unlocked since the last call.
export function consumeAchievementNotifications(): string[] {
  if (pendingNotifications.length === 0) return [];
  return pendingNotifications.splice(0, pendingNotifications.length);
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
