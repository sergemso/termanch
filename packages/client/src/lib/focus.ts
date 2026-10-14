/**
 * Remembers what has focus now and returns a function that gives it back. A modal <dialog> takes focus when it
 * opens, and Svelte removes it from the page without the browser's usual "return focus" step, so closing a
 * menu used to leave the terminal blurred (#107). Call it before the dialog opens, restore when it goes away.
 */
export function rememberFocus(doc: { activeElement: unknown; body: unknown } = document): () => void {
  const previous = doc.activeElement as { isConnected: boolean; focus: (o?: { preventScroll: boolean }) => void } | null;
  return () => {
    if (previous && previous !== doc.body && previous.isConnected) previous.focus({ preventScroll: true });
  };
}
