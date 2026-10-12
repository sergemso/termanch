// Small fixes for the terminal's hidden input on phones.

/**
 * The keyboard's return key says "return" (not "OK/Done"), and when iOS blurs the field right after an Enter,
 * the focus is taken back so the terminal stays active. Returns the function that removes the listeners.
 */
export function attachReturnKeyGuard(area: HTMLTextAreaElement, refocus: () => void, now: () => number = () => performance.now()): () => void {
  area.setAttribute('enterkeyhint', 'enter');
  let lastEnter = -Infinity;
  const noteEnter = (e: Event) => {
    if ((e as KeyboardEvent).key === 'Enter' || (e as InputEvent).inputType === 'insertLineBreak') lastEnter = now();
  };
  const onBlur = () => {
    if (now() - lastEnter < 600) setTimeout(refocus, 0);
  };
  area.addEventListener('keydown', noteEnter, true);
  area.addEventListener('beforeinput', noteEnter, true);
  area.addEventListener('blur', onBlur);
  return () => {
    area.removeEventListener('keydown', noteEnter, true);
    area.removeEventListener('beforeinput', noteEnter, true);
    area.removeEventListener('blur', onBlur);
  };
}
