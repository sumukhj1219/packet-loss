import type { GameState } from './types';

// Not in the PRD — a one-shot atmospheric event at the 40th patch: the virus "hijacks" the
// building's lights, telegraphed via a blocking dialog (see dialog.ts's checkDialogTriggers)
// while the screen flickers for this long. Ticks down regardless of dialog-block state so the
// lights keep flickering through the dialog's own blocking window instead of freezing with it.
export const LIGHT_FLICKER_DURATION_MS = 10000;

export function updateLightFlicker(state: GameState, deltaMs: number): void {
  if (state.lightFlickerRemainingMs <= 0) return;
  state.lightFlickerRemainingMs = Math.max(0, state.lightFlickerRemainingMs - deltaMs);
}
