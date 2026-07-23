import { LIGHT_FLICKER_DURATION_MS } from './lightFlicker';
import type { GameState } from './types';

// Not in the PRD — every dialog now blocks and requires Enter to dismiss, not just the
// boot tutorial. `portrait` stays purely cosmetic (which avatar shows); pausesSimulation
// is always true so pumpDialogQueue/dismissActiveDialog freeze the game uniformly.
// Returns whether this call newly queued the event (false on every later re-check once a
// one-shot id has already fired) — callers that need to trigger a side effect exactly once
// alongside the dialog (e.g. starting the lights-hacked flicker) key off this, not the
// trigger condition itself, since that condition can stay true for many frames in a row.
function fireDialogEvent(state: GameState, id: string, text: string, portrait: 'guide' | 'alert' = 'alert'): boolean {
  if (state.dialog.triggeredEventIds.has(id)) return false;
  state.dialog.triggeredEventIds.add(id);
  state.dialog.queue.push({ id, text, portrait, pausesSimulation: true });
  return true;
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
    'guide',
  );
}

// SECTION 3.1 — tick-driven trigger evaluation
export function checkDialogTriggers(state: GameState): void {
  if (state.totalPatches === 2) {
    fireDialogEvent(
      state,
      'av_tower_intro',
      'New tool: press T to drop an Antivirus Tower (1000 TB). Instantly cures nearby infected racks and shields them for 10s.',
      'guide',
    );
  }

  if (state.totalPatches === 4) {
    fireDialogEvent(
      state,
      'economy_and_immunity_tip',
      'Tip: curing an infected rack refunds 350 TB and grants it 5s of immunity. Prioritize infected racks over idle ones.',
      'guide',
    );
  }

  if (state.totalPatches === 5) {
    fireDialogEvent(
      state,
      'mid_game_5_patches',
      "Good job! 5 rigs stabilized. Heads up — the virus updates its firewall every 10 patches, adding 2 more infections.",
    );
  }

  if (state.totalPatches === 40) {
    const justFired = fireDialogEvent(
      state,
      'lights_hacked',
      "ALERT: The virus has hijacked the building's lighting control system. External engineers are working to restore it.",
      'alert',
    );
    if (justFired) state.lightFlickerRemainingMs = LIGHT_FLICKER_DURATION_MS;
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
