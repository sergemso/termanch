// What the user can actually see. On iOS Safari the soft keyboard shrinks the *visual* viewport and Safari
// then scrolls it inside the layout viewport (offsetTop > 0), so an element sized to the visual viewport must
// also be moved by that offset or its bottom (the key row) ends up under the keyboard.

export interface ViewportSource {
  height: number;
  width: number;
  offsetTop: number;
  offsetLeft: number;
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
export function debugText(vv: ViewportSource | null | undefined, win: { innerHeight: number; innerWidth: number }, box: Box): string {
  return [
    `inner ${win.innerWidth}x${win.innerHeight}`,
    vv ? `vv ${Math.round(vv.width)}x${Math.round(vv.height)} top ${Math.round(vv.offsetTop)} left ${Math.round(vv.offsetLeft)}` : 'vv none',
    `box ${Math.round(box.width)}x${Math.round(box.height)} @${Math.round(box.top)},${Math.round(box.left)}`,
    `keyboard ${box.keyboard}`,
  ].join('\n');
}
