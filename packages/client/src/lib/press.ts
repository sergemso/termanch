// One activation per action for a key that must not take focus. A pointer press fires on pointerdown with
// preventDefault (the phone keyboard keeps its state); the click that follows from the same press is ignored;
// Enter and Space on a focused key arrive as a click with no press before it, and fire.

export const CLICK_ECHO_MS = 600;

export interface Press {
  pointerdown(e: { preventDefault(): void }): void;
  /** The finger lifted: the click echo is measured from here, so a long press is still one action. */
  pointerup(): void;
  click(): void;
}

export function createPress(fire: () => void, now: () => number = () => Date.now()): Press {
  let lastDown = -Infinity;
  return {
    pointerdown(e) {
      e.preventDefault();
      lastDown = now();
      fire();
    },
    pointerup() {
      if (lastDown > -Infinity) lastDown = now();
    },
    click() {
      if (now() - lastDown < CLICK_ECHO_MS) {
        lastDown = -Infinity; // the echo of the press just handled; a later click is a new activation
        return;
      }
      fire();
    },
  };
}

/** Svelte action: `<button use:press={fn}>`. */
export function press(node: HTMLElement, fire: () => void) {
  let current = fire;
  const p = createPress(() => current());
  node.addEventListener('pointerdown', p.pointerdown);
  node.addEventListener('pointerup', p.pointerup);
  node.addEventListener('click', p.click);
  return {
    update(next: () => void) { current = next; },
    destroy() {
      node.removeEventListener('pointerdown', p.pointerdown);
      node.removeEventListener('pointerup', p.pointerup);
      node.removeEventListener('click', p.click);
    },
  };
}
