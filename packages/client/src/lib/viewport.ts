// What the user can actually see. On iOS Safari the soft keyboard shrinks the *visual* viewport and Safari
// then scrolls it inside the layout viewport (offsetTop > 0), so an element sized to the visual viewport must
// also be moved by that offset or its bottom (the key row) ends up under the keyboard.

export interface ViewportSource {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft: number;
}

export interface ViewportReading extends ViewportSource {
  scale: number;
  pageLeft: number;
  pageTop: number;
}

/**
 * The numbers that tell a zoomed or panned page from a broken layout (iOS zooms into a focused field under 16px and
 * pans the visual viewport; pinching back fixes it). `focus` names the element that holds the keyboard.
 */
export function viewportReading(vv: ViewportReading | null | undefined, win: { scrollX: number; scrollY: number }, active: Element | null): string {
  if (!vv) return 'none';
  const tag = active ? `${active.tagName.toLowerCase()}${active.className ? '.' + String(active.className).split(' ')[0] : ''}` : 'none';
  const n = (v: number) => Math.round(v * 100) / 100;
  return `${Math.round(vv.width)}x${Math.round(vv.height)} scale ${n(vv.scale)} offset ${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)} page ${Math.round(vv.pageLeft)},${Math.round(vv.pageTop)} scroll ${Math.round(win.scrollX)},${Math.round(win.scrollY)} focus ${tag}`;
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  /** The soft keyboard (or similar chrome) takes a real part of the screen. */
  keyboard: boolean;
}

/** A keyboard is at least ~200 px on every phone; browser toolbar changes are smaller. */
export const KEYBOARD_MIN_PX = 150;

export function viewportBox(vv: ViewportSource | null | undefined, win: { innerHeight: number; innerWidth: number }): Box {
  if (!vv) return { top: 0, left: 0, width: win.innerWidth, height: win.innerHeight, keyboard: false };
  return {
    top: Math.max(0, vv.offsetTop),
    left: Math.max(0, vv.offsetLeft),
    width: vv.width,
    height: vv.height,
    keyboard: win.innerHeight - vv.height > KEYBOARD_MIN_PX,
  };
}

/** `?debug` shows the numbers behind the layout so one screenshot from a phone settles a viewport bug. */
export function debugText(vv: (ViewportSource & Partial<ViewportReading>) | null | undefined, win: { innerHeight: number; innerWidth: number }, box: Box): string {
  return [
    `inner ${win.innerWidth}x${win.innerHeight}`,
    vv ? `vv ${Math.round(vv.width)}x${Math.round(vv.height)} top ${Math.round(vv.offsetTop)} left ${Math.round(vv.offsetLeft)} scale ${Math.round((vv.scale ?? 1) * 100) / 100}` : 'vv none',
    `box ${Math.round(box.width)}x${Math.round(box.height)} @${Math.round(box.top)},${Math.round(box.left)}`,
    `keyboard ${box.keyboard}`,
  ].join('\n');
}

export const DEBUG_KEY = 'termenbox_debug';

/** `?debug` in the address, or the switch saved by tapping the title five times (an installed PWA has no address bar). */
export function debugEnabled(search: string, stored: string | null): boolean {
  return new URLSearchParams(search).has('debug') || stored === '1';
}

/** Counts rapid taps; true on the one that reaches `needed` within `windowMs`. */
export function tapCounter(needed = 5, windowMs = 3000) {
  let times: number[] = [];
  return (now: number): boolean => {
    times = [...times.filter((t) => now - t <= windowMs), now];
    if (times.length >= needed) {
      times = [];
      return true;
    }
    return false;
  };
}
