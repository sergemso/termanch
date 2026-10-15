// The terminal bell (BEL, \x07): a short beep, which agents and shells use to say "look at me".
//
// Three iOS rules shape this file:
//  1. Audio starts only inside a user gesture, and `pointerdown` does not count: unlock on the events that do
//     (`touchend`, `click`, `keydown`, `pointerup`), once, and keep trying until the context is running.
//  2. Web Audio obeys the ringer switch unless the page declares itself as playback
//     (`navigator.audioSession.type = "playback"`, iOS 16.4+).
//  3. A context created before the gesture stays suspended, so it is created inside the gesture.
const KEY = 'termenbox_bell';
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

let ctx: AudioContext | null = null;

export const bellEnabled = (storage: Pick<Storage, 'getItem'> = localStorage) => storage.getItem(KEY) !== '0';
export const setBellEnabled = (on: boolean, storage: Pick<Storage, 'setItem'> = localStorage) => storage.setItem(KEY, on ? '1' : '0');

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

/** Creates/resumes the audio context. Call from a gesture handler; returns whether sound can play now. */
export function unlockAudio(): boolean {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    const session = (navigator as AudioSessionNav).audioSession;
    if (session) session.type = 'playback'; // audible even with the ringer switch off
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

/** Unlocks audio on the first real gesture; returns the function that removes the listeners. */
export function installAudioUnlock(target: Document = document): () => void {
  const handler = () => {
    if (unlockAudio()) remove();
  };
  const remove = () => UNLOCK_EVENTS.forEach((name) => target.removeEventListener(name, handler, true));
  UNLOCK_EVENTS.forEach((name) => target.addEventListener(name, handler, true));
  return remove;
}

/** Plays the beep; false when audio is not unlocked yet (the caller can tell the user to tap). */
export function beep(): boolean {
  if (!ctx || ctx.state !== 'running') return false;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.27);
  return true;
}
