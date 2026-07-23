import type { GameState } from './types';

// Not in the PRD — a recurring "bad connection" event: input gets buffered for a short
// window then flushed as a burst, telegraphed by a non-blocking "CONNECTION UNSTABLE"
// banner first. Entirely separate from the dialog system — gameplay keeps running through
// both the telegraph and the buffer window, since the whole point is that the world keeps
// moving dangerously while the player's own input isn't landing.
export const CONNECTION_LAG_MIN_INTERVAL_MS = 15000;
export const CONNECTION_LAG_MAX_INTERVAL_MS = 25000;
export const CONNECTION_LAG_TELEGRAPH_MS = 1000;
export const CONNECTION_LAG_BUFFER_MIN_MS = 300;
export const CONNECTION_LAG_BUFFER_MAX_MS = 800;

export function randomConnectionLagInterval(): number {
  return CONNECTION_LAG_MIN_INTERVAL_MS + Math.random() * (CONNECTION_LAG_MAX_INTERVAL_MS - CONNECTION_LAG_MIN_INTERVAL_MS);
}

function randomConnectionLagBufferDuration(): number {
  return CONNECTION_LAG_BUFFER_MIN_MS + Math.random() * (CONNECTION_LAG_BUFFER_MAX_MS - CONNECTION_LAG_BUFFER_MIN_MS);
}

// Advances the idle -> telegraph -> buffer state machine by one frame. Returns true only on
// the exact frame the buffer window empties (the "flush" frame) — main.ts uses that to apply
// the movement burst and fire whatever interact/antivirus presses were buffered.
export function updateConnectionLag(state: GameState, deltaMs: number): boolean {
  const lag = state.connectionLag;

  if (lag.bufferRemainingMs > 0) {
    lag.bufferRemainingMs = Math.max(0, lag.bufferRemainingMs - deltaMs);
    if (lag.bufferRemainingMs === 0) {
      lag.nextEventAtMs = state.elapsedMs + randomConnectionLagInterval();
      return true;
    }
    return false;
  }

  if (lag.telegraphRemainingMs > 0) {
    lag.telegraphRemainingMs = Math.max(0, lag.telegraphRemainingMs - deltaMs);
    if (lag.telegraphRemainingMs === 0) {
      lag.bufferDurationMs = randomConnectionLagBufferDuration();
      lag.bufferRemainingMs = lag.bufferDurationMs;
      lag.bufferedInteractPress = false;
      lag.bufferedAntivirusPress = false;
    }
    return false;
  }

  if (state.elapsedMs >= lag.nextEventAtMs) {
    lag.telegraphRemainingMs = CONNECTION_LAG_TELEGRAPH_MS;
  }
  return false;
}

export function isInputBuffered(state: GameState): boolean {
  return state.connectionLag.bufferRemainingMs > 0;
}
