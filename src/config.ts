// SECTION 1.1 — Grid Configuration (logical adjacency grid, not screen layout)
export const GRID_COLS = 5;
export const GRID_ROWS = 4;
export const RACK_COUNT = GRID_COLS * GRID_ROWS; // 20

export const RACK_TILE_SIZE = 96; // px, includes padding gutter (bookkeeping only, see 1.1)

// SECTION — Player movement & sprint/stamina
// Lowered from 180 now that sprint covers burst movement — the old flat 180 made every
// approach feel the same; base speed now reads as deliberately more cautious.
export const PLAYER_SPEED = 140; // px/sec, walking
export const PLAYER_SPRINT_SPEED = 240; // px/sec while sprinting (Shift), gated by stamina
export const STAMINA_MAX = 100;
export const STAMINA_DRAIN_PER_SECOND = 40; // full tank empties after ~2.5s of continuous sprint
export const STAMINA_REGEN_PER_SECOND = 25; // ~4s to refill from empty, only while not sprinting

// SECTION 1.6 — Room Layout & Player Collision (top-down room-space)
export const ROOM_WIDTH = 960; // px, playable floor area
// Tall enough that the top/bottom rows of the 4-row grid clear the room walls by more than
// the 52px collision threshold (footprint half + player radius) — otherwise clampToRoom fights
// resolveServerCollisions and traps the player against a wall-adjacent rack. See ROOM_CELL_SIZE.
export const ROOM_HEIGHT = 760;
export const SERVER_FOOTPRINT = 72; // px, roughly square footprint per unit incl. walk clearance
// Spacing between server centers. The player<->server collision box (Section 1.6) is
// inflated by the player's own boundingRadius (16px) on top of the footprint half-width,
// so the true blocked zone per server is (SERVER_FOOTPRINT/2 + boundingRadius) = 52px from
// center. Cell size must clear two of those (104px) with room to spare, or adjacent racks'
// blocked zones overlap and seal the corridor between them.
export const ROOM_CELL_SIZE = 170;

// Max random per-axis offset applied to each server's grid slot (see room.ts layoutServers) so
// racks read as a jittered grid instead of a rigid one. Worst case two adjacent racks jitter
// straight at each other, eating 2x this from the 66px corridor left by ROOM_CELL_SIZE above
// (170 - 2*52 = 66) — keep this below 33 or the corridor between two racks can seal shut.
export const SERVER_JITTER = 12;

// SECTION — Room walls (perimeter, drawn as a thick border and carved out of the walkable
// floor). clampToRoom (collision.ts) insets the player bound by this on top of boundingRadius.
export const WALL_THICKNESS = 32;

// SECTION 4.1 — Placeholder Visual Config
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
    IMMUNE: 0x8fce00, // base stays neutral; the immunity ring (4.4) carries the blue "shielded" read
  },
  immunityRing: 0x8fce00,
  lockGlyph: 0x2a2a2a,
  guideAvatar: 0x6fce8f,
  dialogPanel: 0x1c1e26,
  dialogPanelBorder: 0x4fa8ff,
  wall: 0x2f333d,
} as const;

export const ROOM_BACKGROUND_COLOR = 0x11141b;

// SECTION — Side data screen (bezel asset public/assets/screen.png is authored at this exact size)
export const SIDE_SCREEN_WIDTH = 400; // px
export const SIDE_SCREEN_HEIGHT = 760; // px, matches ROOM_HEIGHT so the two panels align edge-to-edge

// SECTION — Data Pool progress bar (side screen). Segment count is a display resolution
// choice, not tied to any other constant — slot value (TB per segment) is derived from
// maxDataPool at render time so it stays correct if maxDataPool ever changes.
export const DATA_POOL_SLOT_COUNT = 20; // 500 TB per slot @ maxDataPool 10000
export const DATA_POOL_SLOT_WIDTH = 14; // px, matches public/assets/data-*.png frame size
export const DATA_POOL_SLOT_HEIGHT = 28; // px
// Tier thresholds pick which of the 3 slot textures (public/assets/data-full/-half/-empty.png)
// filled slots render with. Independent of the 50%/25% dialog-warning thresholds in dialog.ts —
// this is a visual read of pool health, not an event trigger.
export const DATA_POOL_TIER_HALF_RATIO = 0.5;
export const DATA_POOL_TIER_EMPTY_RATIO = 0.2;
