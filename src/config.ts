// SECTION 1.1 — Grid Configuration (logical adjacency grid, not screen layout)
export const GRID_COLS = 5;
export const GRID_ROWS = 4;
export const RACK_COUNT = GRID_COLS * GRID_ROWS; // 20

export const RACK_TILE_SIZE = 96; // px, includes padding gutter (bookkeeping only, see 1.1)

// SECTION 1.6 — Room Layout & Player Collision (top-down room-space)
export const ROOM_WIDTH = 960; // px, playable floor area
// Tall enough that the top/bottom rows of the 4-row grid clear the room walls by more than
// the 68px collision threshold (footprint half + player radius) — otherwise clampToRoom fights
// resolveServerCollisions and traps the player against a wall-adjacent rack. See ROOM_CELL_SIZE.
export const ROOM_HEIGHT = 760;
export const SERVER_FOOTPRINT = 72; // px, roughly square footprint per unit incl. walk clearance
// Spacing between server centers. The player<->server collision box (Section 1.6) is
// inflated by the player's own boundingRadius (32px) on top of the footprint half-width,
// so the true blocked zone per server is (SERVER_FOOTPRINT/2 + boundingRadius) = 68px from
// center. Cell size must clear two of those (136px) with room to spare, or adjacent racks'
// blocked zones overlap and seal the corridor between them.
export const ROOM_CELL_SIZE = 170;

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
    IMMUNE: 0x8a8f98, // base stays neutral; the immunity ring (4.4) carries the blue "shielded" read
  },
  immunityRing: 0x4fd2ff,
  lockGlyph: 0x2a2a2a,
  guideAvatar: 0x6fce8f,
  dialogPanel: 0x1c1e26,
  dialogPanelBorder: 0x4fa8ff,
} as const;

export const ROOM_BACKGROUND_COLOR = 0x11141b;

// SECTION — Side data screen (bezel asset public/assets/screen.png is authored at this exact size)
export const SIDE_SCREEN_WIDTH = 400; // px
export const SIDE_SCREEN_HEIGHT = 760; // px, matches ROOM_HEIGHT so the two panels align edge-to-edge
