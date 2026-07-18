import { Text } from 'pixi.js';
import type { GameState } from '../types';

export function buildDataPoolHud(): Text {
  const text = new Text({
    text: '',
    style: { fill: 0xffffff, fontSize: 18, fontFamily: 'monospace', lineHeight: 24 },
  });
  text.x = 16;
  text.y = 16;
  return text;
}

export function updateDataPoolHud(hud: Text, state: GameState): void {
  const seconds = Math.floor(state.elapsedMs / 1000);
  hud.text = `Data Pool: ${Math.ceil(state.dataPool)} / ${state.maxDataPool} TB\nPatches: ${state.totalPatches}\nTime: ${seconds}s`;
}
