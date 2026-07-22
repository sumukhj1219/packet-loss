const SFX_VOLUME = 0.6;
const BACKGROUND_VOLUME = 0.25;
// Detuned down from the source track so the loop reads as a low ambient hum rather than
// the raw recording — "slow medium pitch" per the asset brief.
const BACKGROUND_PLAYBACK_RATE = 0.85;

type PitchPreservingAudioElement = HTMLAudioElement & {
  preservesPitch?: boolean;
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};

function loadSfx(path: string, volume: number): HTMLAudioElement {
  const audio = new Audio(path);
  audio.volume = volume;
  audio.preload = 'auto';
  return audio;
}

// Cloning the node per play lets an effect overlap itself (e.g. two servers infected in the
// same tick) instead of a second play() call cutting off the first.
function playOneShot(template: HTMLAudioElement): void {
  const instance = template.cloneNode(true) as HTMLAudioElement;
  instance.volume = template.volume;
  instance.play().catch(() => {});
}

const buzzerSfx = loadSfx('/assets/buzzer.mp3', SFX_VOLUME);
const towerSfx = loadSfx('/assets/tower.mp3', SFX_VOLUME);
const dialogSfx = loadSfx('/assets/dialog.mp3', SFX_VOLUME);

const backgroundMusic: PitchPreservingAudioElement = loadSfx('/assets/background.mp3', BACKGROUND_VOLUME);
backgroundMusic.loop = true;
backgroundMusic.playbackRate = BACKGROUND_PLAYBACK_RATE;
// Some engines (notably Safari) "preserve pitch" by default when playbackRate changes, which
// would make the slowdown audible as tempo only — force it off so the rate change lowers pitch.
backgroundMusic.preservesPitch = false;
backgroundMusic.mozPreservesPitch = false;
backgroundMusic.webkitPreservesPitch = false;

let backgroundStarted = false;

// Autoplay is blocked without a prior user gesture in most browsers. Call this once at
// bootstrap; if the browser rejects it, retry on the first keydown/pointerdown (which will
// happen the instant the player touches the game, before any gameplay input matters).
export function startBackgroundMusic(): void {
  if (backgroundStarted) return;
  backgroundMusic
    .play()
    .then(() => {
      backgroundStarted = true;
    })
    .catch(() => {
      const retry = () => {
        window.removeEventListener('keydown', retry);
        window.removeEventListener('pointerdown', retry);
        startBackgroundMusic();
      };
      window.addEventListener('keydown', retry, { once: true });
      window.addEventListener('pointerdown', retry, { once: true });
    });
}

export function playBuzzerSfx(): void {
  playOneShot(buzzerSfx);
}

export function playTowerSfx(): void {
  playOneShot(towerSfx);
}

export function playDialogSfx(): void {
  playOneShot(dialogSfx);
}
