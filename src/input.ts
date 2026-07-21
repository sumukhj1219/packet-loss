const MOVE_KEYS = {
  ArrowUp: 'UP',
  KeyW: 'UP',
  ArrowDown: 'DOWN',
  KeyS: 'DOWN',
  ArrowLeft: 'LEFT',
  KeyA: 'LEFT',
  ArrowRight: 'RIGHT',
  KeyD: 'RIGHT',
} as const;

type MoveKeyCode = keyof typeof MOVE_KEYS;
type MoveDirection = (typeof MOVE_KEYS)[MoveKeyCode];

const heldDirections = new Set<MoveDirection>();
let interactJustPressed = false;
let antivirusJustPressed = false;
let sprintHeld = false;

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    const dir = MOVE_KEYS[e.code as MoveKeyCode];
    if (dir) heldDirections.add(dir);

    if (e.code === 'Space' && !e.repeat) {
      interactJustPressed = true;
      e.preventDefault(); // avoid page-scroll on spacebar
    }

    if (e.code === 'KeyT' && !e.repeat) {
      antivirusJustPressed = true;
    }

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      sprintHeld = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    const dir = MOVE_KEYS[e.code as MoveKeyCode];
    if (dir) heldDirections.delete(dir);

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      sprintHeld = false;
    }
  });
}

// Edge-triggered: true at most once per physical spacebar press, then consumed.
export function consumeInteractPress(): boolean {
  if (interactJustPressed) {
    interactJustPressed = false;
    return true;
  }
  return false;
}

// Edge-triggered: true at most once per physical 'T' press, then consumed.
export function consumeAntivirusPress(): boolean {
  if (antivirusJustPressed) {
    antivirusJustPressed = false;
    return true;
  }
  return false;
}

// Level-triggered (unlike the presses above) — sprint is active for as long as Shift is
// physically held, not a one-shot toggle.
export function isSprintHeld(): boolean {
  return sprintHeld;
}

// Returns a unit-length (or zero) axis vector — diagonals are normalized so
// holding two keys doesn't move faster than a single direction.
export function getMovementAxis(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (heldDirections.has('LEFT')) x -= 1;
  if (heldDirections.has('RIGHT')) x += 1;
  if (heldDirections.has('UP')) y -= 1;
  if (heldDirections.has('DOWN')) y += 1;

  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.SQRT2;
    x *= inv;
    y *= inv;
  }

  return { x, y };
}
