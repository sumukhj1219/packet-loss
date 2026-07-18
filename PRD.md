# PRD: "Bad Connection" — Server Room Survival
**Jam Theme:** Bad Connection · **Duration:** 10 days · **Stack:** Vite + TypeScript + PixiJS v8 + @wavedash/sdk-js
**Audience:** This document is written as an implementation spec for an autonomous coding agent (Claude Code). Every mechanic below is defined in terms of concrete data shapes, thresholds, and algorithms — not prose intentions.

---

## 0. Concept Summary

The player is an IT Engineer, viewed **top-down**, walking freely around a single-screen server room. 15–20 server units sit on the room floor as physical, collidable objects — a warehouse floor plan, not a wall-mounted shelf. The player navigates *between* and *around* them, not along fixed lanes. A virus randomly breaks out in one server, drains a shared **Data Pool** (starts at `10,000 TB`), and spreads to adjacent idle servers over time. The player patches servers to grant temporary immunity and stop the drain. Every 10th successful patch (10, 20, 30...) causes the virus to duplicate itself into a new random location, escalating difficulty forever. The run ends when the Data Pool hits 0. Score = patches survived / time survived, submitted to a Wavedash leaderboard.

**Important distinction:** "grid" elsewhere in this doc refers only to the *logical adjacency graph* used for virus-spread math (which server counts as "next to" which, for infection-jump purposes). It does **not** mean the player's movement is grid-locked, and servers do not render as a rack shelf — they're placed in open room-space with walkable gaps between them. See 1.6.

---

## SECTION 1: SYSTEM ARCHITECTURE & STATE MANAGEMENT

### 1.1 Grid Configuration

Use a flat array indexed by `row * cols + col` for O(1) neighbor math. This `cols × rows` shape is purely a bookkeeping index for "who's adjacent to whom" — actual on-screen positions come from `RoomLayout` in 1.6, with real walkable gaps between units. 20 racks fits a clean `5 cols × 4 rows` logical grid (adjust to `4×4=16` if 15–20 needs to trend smaller for visual clarity on a single screen).

```ts
export const GRID_COLS = 5;
export const GRID_ROWS = 4;
export const RACK_COUNT = GRID_COLS * GRID_ROWS; // 20, within the 15–20 spec

export const RACK_TILE_SIZE = 96; // px, includes padding gutter
```

### 1.2 ServerComponent

```ts
export type ServerState = 'LOCKED' | 'IDLE' | 'INFECTED' | 'IMMUNE';

export interface ServerComponent {
  id: number;                // flat grid index, 0..RACK_COUNT-1
  gridX: number;              // column
  gridY: number;               // row
  state: ServerState;
  worldX: number;              // computed pixel position
  worldY: number;
  dataDrainPerSecond: number;  // e.g. 40, only applied while INFECTED
  immunityRemainingMs: number; // counts down from 5000 while IMMUNE, else 0
  infectedAtMs: number | null; // timestamp virus took this rack, used for spread pacing
  visual: PIXI.Container;       // active display object — Graphics primitive for now, swaps to Sprite once assets land
  overlayVisual: PIXI.Container | null; // immunity ring indicator, only mounted while IMMUNE
  neighborIds: number[];       // precomputed adjacent server ids (see 2.1)
}
```

`LOCKED` racks exist as a difficulty/visual-variety option (e.g. 2–3 racks start locked and open at score milestones) but are never targetable by the virus or the player — see filtering rules in Section 2.

### 1.3 PlayerComponent

```ts
export type PlayerState = 'IDLE' | 'MOVING' | 'PATCHING' | 'STUNNED';
export type FacingDirection = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

export interface PlayerComponent {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  speed: number;                 // px/sec, e.g. 180
  currentState: PlayerState;
  facing: FacingDirection;
  facingLocked: boolean;         // true during PATCHING — see 1.3.1
  patchTimer: number;            // counts up 0 -> 1000ms during PATCHING
  targetServerId: number | null; // rack currently being patched
  visual: PIXI.Container;        // Graphics primitive for now, swaps to Sprite once assets land
  boundingRadius: number;        // 32 (half of 64x64), used for proximity checks
}
```

**1.3.1 State transition rules**

- `IDLE -> MOVING`: any WASD/arrow key held, `velocityX/Y != 0`.
- `MOVING -> IDLE`: no movement keys held.
- `MOVING|IDLE -> PATCHING`: player presses interact (click or spacebar) while within `INTERACT_RADIUS = 64px` of an `IDLE` or `INFECTED` server. On entry: `velocityX = velocityY = 0`, `facingLocked = true`, `facing` snaps to `LEFT` or `RIGHT` (whichever points toward `targetServerId`, computed by sign of `targetServer.worldX - player.x`), `patchTimer = 0`.
- `PATCHING -> IDLE`: fires automatically when `patchTimer >= 1000ms`. On exit: `facingLocked = false`, `targetServerId = null`, server transitions per Section 2.3.
- `* -> STUNNED`: reserved hook (e.g. future "virus lashes back" mechanic); not required for MVP but the state and a `stunTimer` field should exist so Claude Code doesn't need a schema migration later.

### 1.4 DialogManager

```ts
export interface DialogEvent {
  id: string;              // unique key, used for de-duplication
  text: string;
  portrait: 'guide' | 'alert';
  pausesSimulation: boolean; // true only for the boot tutorial event
}

export interface DialogManagerState {
  queue: DialogEvent[];
  activeEvent: DialogEvent | null;
  triggeredEventIds: Set<string>; // ensures one-shot events never re-fire
  isBlockingInput: boolean;       // true while activeEvent.pausesSimulation
}
```

### 1.5 Global GameState

```ts
export interface GameState {
  dataPool: number;            // starts 10000, floors at 0
  maxDataPool: number;         // 10000, used for % thresholds
  totalPatches: number;        // increments on every successful PATCHING completion
  lastDuplicationMultiple: number; // last totalPatches value that triggered duplication, prevents double-fire
  servers: ServerComponent[];
  player: PlayerComponent;
  dialog: DialogManagerState;
  virusPaused: boolean;        // true until first infection is cleared (Section 3)
  gameOver: boolean;
  elapsedMs: number;
}
```

### 1.6 Room Layout & Player Collision (Top-Down Specific)

Because this is top-down free movement, two things the rack-shelf framing didn't need are required here: **room boundaries** and **player↔server collision** (a server is a floor obstacle, not a wall decoration you walk past unobstructed).

```ts
export const ROOM_WIDTH = 960;   // px, playable floor area
export const ROOM_HEIGHT = 640;
export const SERVER_FOOTPRINT = 72; // px, roughly square footprint per unit incl. walk clearance

export interface RoomLayout {
  cols: number;      // for adjacency math only, see 1.1
  rows: number;
  originX: number;    // top-left of the floor-plan grid within ROOM_WIDTH/HEIGHT
  originY: number;
  cellSize: number;   // spacing between server centers, > SERVER_FOOTPRINT so paths stay walkable
}
```

`worldX`/`worldY` on `ServerComponent` are computed once at layout time from `RoomLayout`, not re-derived every frame:

```ts
function layoutServers(layout: RoomLayout): { worldX: number; worldY: number }[] {
  const positions = [];
  for (let i = 0; i < RACK_COUNT; i++) {
    const gx = i % layout.cols;
    const gy = Math.floor(i / layout.cols);
    positions.push({
      worldX: layout.originX + gx * layout.cellSize,
      worldY: layout.originY + gy * layout.cellSize,
    });
  }
  return positions;
}
```

Keep `cellSize` comfortably larger than `SERVER_FOOTPRINT` (e.g. `cellSize = 120` vs `footprint = 72`) so there's always a walkable gap on all four sides — this is what makes the "walk around it" navigation actually work instead of servers reading as a solid wall.

**Player movement clamping (room walls):**

```ts
function clampToRoom(player: PlayerComponent): void {
  player.x = Math.max(player.boundingRadius, Math.min(ROOM_WIDTH - player.boundingRadius, player.x));
  player.y = Math.max(player.boundingRadius, Math.min(ROOM_HEIGHT - player.boundingRadius, player.y));
}
```

**Player↔server collision (AABB, resolved after movement, before render):**

```ts
function resolveServerCollisions(player: PlayerComponent, servers: ServerComponent[]): void {
  const half = SERVER_FOOTPRINT / 2;

  for (const server of servers) {
    const dx = player.x - server.worldX;
    const dy = player.y - server.worldY;
    const overlapX = (half + player.boundingRadius) - Math.abs(dx);
    const overlapY = (half + player.boundingRadius) - Math.abs(dy);

    if (overlapX > 0 && overlapY > 0) {
      // push player out along the axis of least overlap
      if (overlapX < overlapY) {
        player.x += dx > 0 ? overlapX : -overlapX;
      } else {
        player.y += dy > 0 ? overlapY : -overlapY;
      }
    }
  }
}
```

This runs every frame after applying `velocityX/Y` and before `clampToRoom`, so the player slides along a server's edge instead of clipping through it — standard top-down obstacle behavior. Note this collision check is intentionally decoupled from the `INTERACT_RADIUS = 64` proximity check in Section 4.5: collision keeps the player *out* of the server's footprint, while patching eligibility is a separate, slightly larger radius so the player doesn't have to be pixel-perfect to interact.

---

## SECTION 2: THE NETWORK VIRUS SIMULATION & JUMP ALGORITHM

### 2.1 Boundary-Checked Neighbor Resolution

Precompute once at grid init (not per-frame):

```ts
function computeNeighborIds(id: number): number[] {
  const x = id % GRID_COLS;
  const y = Math.floor(id / GRID_COLS);
  const neighbors: number[] = [];

  const candidates = [
    { dx: 0, dy: -1 }, // UP
    { dx: 0, dy: 1 },  // DOWN
    { dx: -1, dy: 0 }, // LEFT
    { dx: 1, dy: 0 },  // RIGHT
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
```

### 2.2 Outbreak Initiation

```ts
function triggerInitialOutbreak(state: GameState): void {
  const eligible = state.servers.filter(s => s.state === 'IDLE');
  const target = eligible[Math.floor(Math.random() * eligible.length)];
  target.state = 'INFECTED';
  target.infectedAtMs = state.elapsedMs;
  // dialog: mark first infection occurred, unpause virus timer per Section 3.2
}
```

### 2.3 Spread Tick (called every `VIRUS_TICK_MS = 2000` while `!virusPaused`)

```ts
const VIRUS_TICK_MS = 2000;
const SPREAD_CHANCE_PER_NEIGHBOR = 0.35;

function virusTick(state: GameState): void {
  if (state.virusPaused || state.gameOver) return;

  const infected = state.servers.filter(s => s.state === 'INFECTED');

  for (const source of infected) {
    // 1. Drain data
    state.dataPool = Math.max(0, state.dataPool - source.dataDrainPerSecond * (VIRUS_TICK_MS / 1000));

    // 2. Attempt spread to each neighbor
    for (const nId of source.neighborIds) {
      const neighbor = state.servers[nId];

      // Jump-eligibility filter: exclude IMMUNE, LOCKED, and already-INFECTED targets
      if (neighbor.state !== 'IDLE') continue;

      if (Math.random() < SPREAD_CHANCE_PER_NEIGHBOR) {
        neighbor.state = 'INFECTED';
        neighbor.infectedAtMs = state.elapsedMs;
      }
    }
  }

  if (state.dataPool <= 0) {
    state.gameOver = true;
  }
}
```

The filter `neighbor.state !== 'IDLE' → continue` is the single line that enforces the spec: `IMMUNE` and `LOCKED` racks are structurally un-targetable because they never equal `'IDLE'`, and already-`INFECTED` racks are skipped to avoid redundant work.

### 2.4 Patch Completion → Immunity Grant

Called from `PlayerComponent` state exit (Section 1.3.1):

```ts
const IMMUNITY_DURATION_MS = 5000;

function completePatch(state: GameState, server: ServerComponent): void {
  server.state = 'IMMUNE';
  server.immunityRemainingMs = IMMUNITY_DURATION_MS;
  server.infectedAtMs = null;
  state.totalPatches += 1;

  checkDuplicationThreshold(state);
  checkDialogTriggers(state); // Section 3.3
}
```

A separate per-frame updater ticks `immunityRemainingMs -= deltaMs` for every `IMMUNE` server and flips it back to `IDLE` (unmounting `overlayVisual`) when it reaches 0.

### 2.5 Duplication on Multiples of 10

```ts
function checkDuplicationThreshold(state: GameState): void {
  const isNewMultipleOf10 =
    state.totalPatches % 10 === 0 &&
    state.totalPatches !== state.lastDuplicationMultiple;

  if (!isNewMultipleOf10) return;

  state.lastDuplicationMultiple = state.totalPatches;

  const currentInfectedCount = state.servers.filter(s => s.state === 'INFECTED').length;
  const eligible = state.servers.filter(s => s.state === 'IDLE');

  // "Duplicate active strains": seed one new infection per currently-active strain,
  // capped by however many IDLE racks remain (never crash on an empty pool).
  const spawnCount = Math.min(Math.max(currentInfectedCount, 1), eligible.length);

  for (let i = 0; i < spawnCount; i++) {
    const idx = Math.floor(Math.random() * eligible.length);
    const target = eligible.splice(idx, 1)[0];
    target.state = 'INFECTED';
    target.infectedAtMs = state.elapsedMs;
  }
}
```

`lastDuplicationMultiple` is the guard that prevents this from firing more than once for the same patch count if `checkDuplicationThreshold` is ever called twice in a frame.

---

## SECTION 3: DIALOG SYSTEM PARSING & EVENT TRIGGERS

### 3.1 Tick-Driven Trigger Evaluation

Every game loop frame, after state updates but before rendering, run one cheap pass:

```ts
function checkDialogTriggers(state: GameState): void {
  const fire = (id: string, text: string, pauses = false) => {
    if (state.dialog.triggeredEventIds.has(id)) return;
    state.dialog.triggeredEventIds.add(id);
    state.dialog.queue.push({ id, text, portrait: pauses ? 'guide' : 'alert', pausesSimulation: pauses });
  };

  // Mid-game milestone
  if (state.totalPatches === 5) {
    fire('mid_game_5_patches',
      "Good job! You've stabilized 5 rigs. Heads up, the virus updates its firewall every 10 patches!");
  }

  // Data pool thresholds — evaluated on the ratio, not the raw number,
  // so it still works if maxDataPool is tuned later.
  const ratio = state.dataPool / state.maxDataPool;
  if (ratio < 0.5) fire('data_below_50', "Data Pool critical: under 50% capacity remaining.");
  if (ratio < 0.25) fire('data_below_25', "PANIC: Data Pool below 25%! Patch anything you can, now!");
}
```

### 3.2 Boot Tutorial & Global Pause Flag

```ts
function bootSequence(state: GameState): void {
  state.virusPaused = true; // held true until first infection is cleared

  state.dialog.queue.push({
    id: 'boot_tutorial',
    text: "Welcome, Engineer. Use WASD or Arrow Keys to move. Approach a rack and click (or press SPACE) to patch it.",
    portrait: 'guide',
    pausesSimulation: true,
  });
  // dialog.isBlockingInput becomes true the moment this event is dequeued as `activeEvent`
}
```

The **blocking flag lives on the dialog event itself** (`pausesSimulation`), not as a separate hardcoded check, so any future one-off event can reuse the same pause behavior without new branching logic.

`virusPaused` is set back to `false` at the exact moment `triggerInitialOutbreak` → the first `completePatch` call transitions that rack out of `INFECTED`. Concretely:

```ts
function onFirstInfectionCleared(state: GameState): void {
  if (state.virusPaused) {
    state.virusPaused = false;
  }
}
```//called from `completePatch` guarded by `state.totalPatches === 1`.

### 3.3 Queue Draining (UI layer)

The dialog UI polls `dialog.queue`. If `dialog.activeEvent === null` and `queue.length > 0`, shift the next event into `activeEvent`, render the `ui_dialog_panel.png` + `guide_avatar.png`, and set `isBlockingInput = activeEvent.pausesSimulation`. On dismiss (click/keypress/auto-timeout for non-blocking alerts), clear `activeEvent` and `isBlockingInput`.

---

## SECTION 4: PIXIJS V8 RENDERING — PLACEHOLDER SHAPES (ASSETS PENDING)

**Status: art assets are not ready yet.** Everything below uses `PIXI.Graphics` primitives instead of loaded textures. The function names and signatures are deliberately kept close to what a texture-based version would look like, so swapping in real art later is a body-swap inside these functions, not a rewrite of the game logic that calls them. The original `public/assets/` file tree from the initial spec is kept at the bottom of this section as a reference for when assets do land — nothing currently reads from it.

### 4.1 Placeholder Visual Config

```ts
export const PLACEHOLDER_COLORS = {
  player: {
    IDLE: 0x4fa8ff,
    MOVING: 0x4fa8ff,
    PATCHING: 0xffd24f,
    STUNNED: 0xff5c5c,
  },
  server: {
    LOCKED: 0x555555,
    IDLE: 0x8a8f98,
    INFECTED: 0xff2e4d,
    IMMUNE: 0x8a8f98, // base stays neutral; the immunity ring (4.4) carries the blue "shielded" read
  },
  immunityRing: 0x4fd2ff,
  lockGlyph: 0x2a2a2a,
  guideAvatar: 0x6fce8f,
  dialogPanel: 0x1c1e26,
  dialogPanelBorder: 0x4fa8ff,
} as const;
```

### 4.2 Player Placeholder Visual

Built once at spawn, then mutated per-frame — no textures involved:

```ts
import { Graphics, Container } from 'pixi.js';

export function buildPlayerVisual(): Container {
  const root = new Container();

  const body = new Graphics()
    .circle(0, 0, 24)
    .fill(PLACEHOLDER_COLORS.player.IDLE);
  body.label = 'body';

  // facing indicator: a small triangle "nose" pointing in the current direction
  const facingMarker = new Graphics()
    .poly([0, -8, 10, 0, 0, 8])
    .fill(0xffffff);
  facingMarker.label = 'facingMarker';
  facingMarker.x = 24; // default: pointing RIGHT

  root.addChild(body, facingMarker);
  return root;
}
```

### 4.3 Player State → Visual Update

Replaces the texture-swap step. Same call site as a texture-based `updatePlayerTexture` would occupy:

```ts
const FACING_ANGLE: Record<FacingDirection, number> = {
  RIGHT: 0,
  DOWN: Math.PI / 2,
  LEFT: Math.PI,
  UP: -Math.PI / 2,
};

function updatePlayerVisual(player: PlayerComponent): void {
  const body = player.visual.getChildByLabel('body') as Graphics;
  const marker = player.visual.getChildByLabel('facingMarker') as Graphics;

  body.tint = PLACEHOLDER_COLORS.player[player.currentState];

  // rotate the facing marker around the body instead of flipping scale.x —
  // shapes don't need the LEFT-mirror trick real sprites would use
  const angle = FACING_ANGLE[player.facing];
  marker.x = Math.cos(angle) * 24;
  marker.y = Math.sin(angle) * 24;
  marker.rotation = angle;

  // simple "activity" cue while no walk-cycle frames exist: pulse scale slightly during MOVING
  body.scale.set(player.currentState === 'MOVING' ? 1.08 : 1.0);
}
```

### 4.4 Server Placeholder Visual

```ts
export function buildServerVisual(): Container {
  const root = new Container();

  const body = new Graphics()
    .roundRect(-30, -30, 60, 60, 6)
    .fill(PLACEHOLDER_COLORS.server.IDLE);
  body.label = 'body';

  const lockGlyph = new Graphics()
    .roundRect(-8, -2, 16, 12, 2)
    .fill(PLACEHOLDER_COLORS.lockGlyph)
    .circle(0, -2, 6)
    .stroke({ width: 3, color: PLACEHOLDER_COLORS.lockGlyph });
  lockGlyph.label = 'lockGlyph';
  lockGlyph.visible = false;

  root.addChild(body, lockGlyph);
  return root;
}

export function buildImmunityRingVisual(): Container {
  const ring = new Graphics()
    .circle(0, 0, 40)
    .stroke({ width: 4, color: PLACEHOLDER_COLORS.immunityRing, alpha: 0.85 });
  ring.visible = false;
  return ring;
}
```

### 4.5 Server State → Visual Update

Direct placeholder equivalent of the original `updateServerVisual`, same call sites:

```ts
function updateServerVisual(server: ServerComponent): void {
  const body = server.visual.getChildByLabel('body') as Graphics;
  const lockGlyph = server.visual.getChildByLabel('lockGlyph') as Graphics;

  body.tint = PLACEHOLDER_COLORS.server[server.state];
  lockGlyph.visible = server.state === 'LOCKED';

  if (server.overlayVisual) {
    server.overlayVisual.visible = server.state === 'IMMUNE';
  }

  // INFECTED flashing: driven by a ticker-based alpha oscillator, not a texture swap
  // e.g. body.alpha = 0.6 + Math.sin(elapsedMs / 150) * 0.4  — wire this in the render loop,
  // gated on server.state === 'INFECTED', so it stops immediately once patched.
}
```

### 4.6 Guide Avatar & Dialog Panel Placeholders

```ts
export function buildGuideAvatarVisual(): Container {
  return new Graphics()
    .circle(0, 0, 28)
    .fill(PLACEHOLDER_COLORS.guideAvatar);
}

export function buildDialogPanelVisual(width: number, height: number): Container {
  return new Graphics()
    .roundRect(0, 0, width, height, 10)
    .fill(PLACEHOLDER_COLORS.dialogPanel)
    .stroke({ width: 2, color: PLACEHOLDER_COLORS.dialogPanelBorder });
}
```

### 4.7 PixiJS v8 Interaction Paradigm

Unaffected by the shapes-vs-textures question — interaction targets `server.visual` (a `Container`), which works identically whether its children are `Graphics` or, later, `Sprite`:

```ts
server.visual.eventMode = 'static';
server.visual.cursor = 'pointer';
server.visual.on('pointertap', () => attemptPatch(server.id));
```

```ts
function attemptPatch(state: GameState, serverId: number): void {
  const server = state.servers[serverId];
  const dist = Math.hypot(server.worldX - state.player.x, server.worldY - state.player.y);
  const INTERACT_RADIUS = 64;

  if (dist > INTERACT_RADIUS) return; // silently ignore, or optionally fire a small "too far" toast
  if (server.state !== 'IDLE' && server.state !== 'INFECTED') return;

  // begin PATCHING state — see Section 1.3.1
}
```

### 4.8 Deferred: Real Asset Manifest (not wired up yet)

Kept here for reference only — do **not** call `loadGameAssets()` or reference these aliases anywhere yet. When assets are ready, implement this function, then go back into 4.2/4.4/4.6 and swap each `buildXVisual()`'s `Graphics` primitives for a `Sprite` built from the matching texture. `updatePlayerVisual` / `updateServerVisual` keep their signatures — only their internals change from `tint`/`visible` toggles to `.texture = ...` swaps.

```ts
import { Assets } from 'pixi.js';

export async function loadGameAssets(): Promise<void> {
  Assets.add({ alias: 'playerSheet', src: '/assets/player_spritesheet.png' });
  Assets.add({ alias: 'serverIdle', src: '/assets/server_idle.png' });
  Assets.add({ alias: 'serverGlitch', src: '/assets/server_glitch.png' });
  Assets.add({ alias: 'shieldOverlay', src: '/assets/shield_overlay.png' });
  Assets.add({ alias: 'guideAvatar', src: '/assets/guide_avatar.png' });
  Assets.add({ alias: 'dialogPanel', src: '/assets/ui_dialog_panel.png' });
  Assets.add({ alias: 'lockIcon', src: '/assets/lock_icon.png' });

  await Assets.load([
    'playerSheet', 'serverIdle', 'serverGlitch',
    'shieldOverlay', 'guideAvatar', 'dialogPanel', 'lockIcon',
  ]);
}
```

Expected file tree once assets exist:

```
my-game/
├── public/
│   └── assets/
│       ├── player_spritesheet.png  (7 rows: Idle/Move/Patch-Side, Idle/Move-Front, Idle/Move-Back)
│       ├── server_idle.png
│       ├── server_glitch.png
│       ├── shield_overlay.png
│       ├── guide_avatar.png
│       ├── ui_dialog_panel.png
│       └── lock_icon.png
```

---


## SECTION 5: WAVEDASH SDK JS INTEGRATION

### 5.1 Boot Initialization

```ts
import Wavedash from '@wavedash/sdk-js';

export async function initWavedash(): Promise<void> {
  await Wavedash.init({
    // project/app id supplied by the jam's Wavedash dashboard
  });
}
```

Call this once, before `loadGameAssets()` or in parallel via `Promise.all`, so the leaderboard/achievement calls have a ready SDK by the time `Game Over` can occur.

### 5.2 Leaderboard Submission on Game Over

```ts
async function onGameOver(state: GameState): Promise<void> {
  state.gameOver = true;

  const score = state.totalPatches; // primary score metric; elapsedMs as tiebreaker/secondary stat

  try {
    await Wavedash.uploadLeaderboardScore({
      score,
      metadata: { elapsedMs: state.elapsedMs, dataPoolAtEnd: state.dataPool },
    });
  } catch (err) {
    console.error('[Wavedash] leaderboard upload failed', err);
    // fail gracefully — never block the game-over screen on network issues
  }
}
```

### 5.3 Achievements

Dispatch at the moment each condition becomes true — not batched at game over — so they persist even on a browser crash mid-run.

```ts
const ACHIEVEMENTS = {
  FIRST_PATCH: 'first_patch',
  SURVIVED_OUTBREAK_DUPLICATION: 'outbreak_survivor',   // lived through a 10x duplication event
  DATA_GUARDIAN: 'data_guardian',                        // game ended (win or timed session) with dataPool > 50%
  RAPID_RESPONSE: 'rapid_response',                      // patched a rack within 2s of it going INFECTED
} as const;

function grantAchievement(id: string): void {
  Wavedash.setAchievement(id).catch(err =>
    console.error(`[Wavedash] failed to set achievement ${id}`, err));
}

// Example call sites:
// - in completePatch(), on state.totalPatches === 1 → grantAchievement(ACHIEVEMENTS.FIRST_PATCH)
// - in checkDuplicationThreshold(), after a duplication event resolves without a game over → grantAchievement(ACHIEVEMENTS.SURVIVED_OUTBREAK_DUPLICATION)
```

---

## SECTION 6: PHASED STEP-BY-STEP DEVELOPMENT ROADMAP

Each milestone is scoped to be buildable, runnable, and verifiable in the browser console/devtools before starting the next — hand these to Claude Code one at a time.

### Milestone 1 — Scaffold & Static Room Render (Placeholder Shapes)
- Vite + TypeScript + PixiJS v8 project init. **Do not implement `loadGameAssets()` yet** — art is pending; see Section 4.8.
- Implement `RoomLayout` + `layoutServers` (Section 1.6) and render 20 servers via `buildServerVisual()` (Section 4.4) placed on the room floor with walkable gaps, plus a single player via `buildPlayerVisual()` (Section 4.2).
- **Verify:** visually confirm 20 gray rounded-square servers render inside the room bounds with clear walkable space between them, and a blue circle player renders with a white directional marker, no console errors.

### Milestone 2 — Free Top-Down Movement, Collision & 4-Direction Facing
- Implement `PlayerComponent`, WASD/arrow input handling, `IDLE ⇄ MOVING` transitions.
- Implement `resolveServerCollisions` and `clampToRoom` (Section 1.6) so the player walks around servers and stays inside the room.
- Implement `updatePlayerVisual` (Section 4.3) — facing marker rotates around the body per direction, no sprite-flip needed with shapes.
- **Verify:** console-log `player.currentState` and `player.facing` on every change; visually confirm the direction marker rotates correctly for all 4 directions and the player cannot walk through a server or off the room edge.

### Milestone 3 — Patching, Proximity, and Immunity (no virus yet)
- Implement `INTERACT_RADIUS` proximity check, `eventMode = 'static'` + `pointertap` on server sprites (Section 4.5).
- Implement full `PATCHING` state machine (1-second lock, facing snap) and `completePatch` → `IMMUNE` transition with the 5-second countdown and `shield_overlay.png` mount/unmount.
- Wire `dataPool` as a visible HUD number (no drain yet — virus doesn't exist this milestone).
- **Verify:** console-log every state transition (`IDLE→PATCHING→IDLE`, `IDLE→IMMUNE→IDLE`) with timestamps; confirm patching from >64px away is rejected.

### Milestone 4 — Virus Simulation Engine
- Implement `computeNeighborIds`, `triggerInitialOutbreak`, `virusTick` (2s interval), and the `IMMUNE`/`LOCKED` jump-filter (Section 2.3).
- Implement `checkDuplicationThreshold` firing on multiples of 10 (Section 2.5).
- Wire `dataPool` drain and the `gameOver` condition at 0.
- **Verify:** console-log every infection, spread, and duplication event with the affected server id(s); manually patch racks in devtools-driven playtesting to confirm duplication only fires once per multiple-of-10 and never targets `IMMUNE`/`LOCKED` racks.

### Milestone 5 — Dialog System, Wavedash Integration & Polish
- Implement `DialogManagerState`, the boot tutorial with `virusPaused` gating (Section 3.2), the 5-patch mid-game warning, and the 50%/25% data alerts (Section 3.1).
- Integrate `Wavedash.init()`, `uploadLeaderboardScore` on game over, and the achievement dispatch points from Section 5.3.
- Final pass: flashing/glitch shader or tint oscillation on `INFECTED` racks, HUD polish, game-over screen with score + retry.
- **Verify:** full playthrough from boot dialog → first patch (virus unpauses) → 5-patch warning → duplication events → 25% panic alert → game over → console-confirmed successful leaderboard call (or graceful failure log).

---

*End of PRD. Each section above is written to be directly actionable — interfaces, functions, and thresholds can be copied near-verbatim into the actual codebase as a starting point.*
