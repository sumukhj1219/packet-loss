import type { GameState } from './types';

function fireDialogEvent(state: GameState, id: string, text: string, pauses = false): void {
  if (state.dialog.triggeredEventIds.has(id)) return;
  state.dialog.triggeredEventIds.add(id);
  state.dialog.queue.push({ id, text, portrait: pauses ? 'guide' : 'alert', pausesSimulation: pauses });
}

// SECTION 3.2 — boot tutorial. Deviation from the literal spec: virusPaused is no longer
// held until the first patch (removed at the user's request — the initial infection should
// drain/spread immediately). Instead it's tied to this dialog's blocking window only, via
// pumpDialogQueue/dismissActiveDialog below, so the player isn't taking undodgeable damage
// while their input is literally blocked by the tutorial text.
export function bootSequence(state: GameState): void {
  fireDialogEvent(
    state,
    'boot_tutorial',
    'Welcome, Engineer. Use WASD or Arrow Keys to move. Approach a rack and click (or press SPACE) to patch it.',
    true,
  );
}

// SECTION 3.1 — tick-driven trigger evaluation
export function checkDialogTriggers(state: GameState): void {
  if (state.totalPatches === 5) {
    fireDialogEvent(
      state,
      'mid_game_5_patches',
      "Good job! You've stabilized 5 rigs. Heads up, the virus updates its firewall every 10 patches!",
    );
  }

  const ratio = state.dataPool / state.maxDataPool;
  if (ratio < 0.5) fireDialogEvent(state, 'data_below_50', 'Data Pool critical: under 50% capacity remaining.');
  if (ratio < 0.25) fireDialogEvent(state, 'data_below_25', 'PANIC: Data Pool below 25%! Patch anything you can, now!');
}

// SECTION 3.3 — queue draining. Call once per frame before rendering.
export function pumpDialogQueue(state: GameState): void {
  if (state.dialog.activeEvent !== null || state.dialog.queue.length === 0) return;

  const next = state.dialog.queue.shift()!;
  state.dialog.activeEvent = next;
  state.dialog.isBlockingInput = next.pausesSimulation;
  state.virusPaused = next.pausesSimulation;
}

export function dismissActiveDialog(state: GameState): void {
  if (!state.dialog.activeEvent) return;

  const wasBlocking = state.dialog.activeEvent.pausesSimulation;
  state.dialog.activeEvent = null;
  state.dialog.isBlockingInput = false;
  if (wasBlocking) {
    state.virusPaused = false;
  }
}
