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

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    const dir = MOVE_KEYS[e.code as MoveKeyCode];
    if (dir) heldDirections.add(dir);

    if (e.code === 'Space' && !e.repeat) {
      interactJustPressed = true;
      e.preventDefault(); // avoid page-scroll on spacebar
    }
  });
  window.addEventListener('keyup', (e) => {
    const dir = MOVE_KEYS[e.code as MoveKeyCode];
    if (dir) heldDirections.delete(dir);
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
