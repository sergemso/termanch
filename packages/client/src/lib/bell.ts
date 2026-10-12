// The terminal bell (BEL, \x07): a short beep, which agents and shells use to say "look at me". Browsers only
// start audio after a tap, so the context is created on the first touch of the terminal.
const KEY = 'termanch_bell';
let ctx: AudioContext | null = null;

export const bellEnabled = (storage: Pick<Storage, 'getItem'> = localStorage) => storage.getItem(KEY) !== '0';
export const setBellEnabled = (on: boolean) => localStorage.setItem(KEY, on ? '1' : '0');

/** Call from a tap handler. */
export function unlockAudio(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* no audio available */
  }
}

export function beep(): void {
  if (!ctx || ctx.state !== 'running') return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.22);
}
