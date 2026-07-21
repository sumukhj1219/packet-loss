import type * as PIXI from 'pixi.js';

// SECTION 1.2 — ServerComponent
export type ServerState = 'LOCKED' | 'IDLE' | 'INFECTED' | 'IMMUNE';

export interface ServerComponent {
  id: number; // flat grid index, 0..RACK_COUNT-1
  gridX: number; // column
  gridY: number; // row
  state: ServerState;
  worldX: number; // computed pixel position
  worldY: number;
  dataDrainPerSecond: number; // e.g. 40, only applied while INFECTED
  immunityRemainingMs: number; // counts down from 5000 while IMMUNE, else 0
  infectedAtMs: number | null; // timestamp virus took this rack, used for spread pacing
  visual: PIXI.Container; // active display object
  overlayVisual: PIXI.Container | null; // immunity ring indicator, only mounted while IMMUNE
  neighborIds: number[]; // precomputed adjacent server ids (see 2.1)
}

// SECTION 1.3 — PlayerComponent
export type PlayerState = 'IDLE' | 'MOVING' | 'PATCHING' | 'STUNNED';
export type FacingDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

export interface PlayerComponent {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  speed: number; // px/sec, walking (see PLAYER_SPEED)
  stamina: number; // 0..STAMINA_MAX, drains while sprinting and moving, regenerates otherwise
  currentState: PlayerState;
  facing: FacingDirection;
  facingLocked: boolean; // true during PATCHING
  patchTimer: number; // counts up 0 -> 1000ms during PATCHING
  targetServerId: number | null; // rack currently being patched
  visual: PIXI.Container;
  boundingRadius: number; // 16 (half of 32x32), used for proximity checks
}

// SECTION 1.6 — Room Layout
export interface RoomLayout {
  cols: number; // for adjacency math only, see 1.1
  rows: number;
  originX: number; // top-left of the floor-plan grid within ROOM_WIDTH/HEIGHT
  originY: number;
  cellSize: number; // spacing between server centers, > SERVER_FOOTPRINT so paths stay walkable
}

// SECTION 1.4 — DialogManager (wired up in Milestone 5)
export interface DialogEvent {
  id: string; // unique key, used for de-duplication
  text: string;
  portrait: 'guide' | 'alert';
  pausesSimulation: boolean; // true only for the boot tutorial event
}

export interface DialogManagerState {
  queue: DialogEvent[];
  activeEvent: DialogEvent | null;
  triggeredEventIds: Set<string>; // ensures one-shot events never re-fire
  isBlockingInput: boolean; // true while activeEvent.pausesSimulation
}

// Antivirus tower: a single placeable, permanent, replaceable area-denial structure (see
// antivirus.ts). Servers within `radius` of it are excluded from every infection-spawn path.
export interface AntivirusTower {
  worldX: number;
  worldY: number;
  radius: number;
}

// SECTION 1.5 — Global GameState
export interface GameState {
  dataPool: number; // starts 10000, floors at 0
  maxDataPool: number; // 10000, used for % thresholds
  totalPatches: number; // increments on every successful PATCHING completion
  lastDuplicationMultiple: number; // last totalPatches value that triggered duplication, prevents double-fire
  servers: ServerComponent[];
  player: PlayerComponent;
  dialog: DialogManagerState;
  virusPaused: boolean; // true until first infection is cleared (Section 3)
  gameOver: boolean;
  elapsedMs: number;
  antivirusTower: AntivirusTower | null;
  antivirusCooldownMs: number; // counts down from ANTIVIRUS_PLACEMENT_COOLDOWN_MS, 0 = ready to place
  antivirusTowersPlacedThisRun: number; // NO_ANTIVIRUS_NEEDED achievement (Section 5.3)
  dataPoolStayedAbove90ThisRun: boolean; // flips false the first time dataPool dips below 90%, UNTOUCHABLE achievement (Section 5.3)
  consecutiveRapidResponses: number; // resets to 0 on any non-rapid infected patch, SPEED_DEMON achievement (Section 5.3)
}
